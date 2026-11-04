export class Shopify {
  constructor(env) {
    this.e = env;
    this.token = null;
  }
  async gql(query, variables) {
    if (!this.token) {
      const r = await fetch(`https://${this.e.SHOPIFY_DOMAIN}/admin/oauth/access_token`, {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.e.SHOPIFY_CLIENT_ID,
          client_secret: this.e.SHOPIFY_CLIENT_SECRET,
        }),
      });
      if (!r.ok) throw Error(`Shopify auth HTTP ${r.status}`);
      this.token = (await r.json()).access_token;
    }
    const r = await fetch(
      `https://${this.e.SHOPIFY_DOMAIN}/admin/api/${this.e.SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'X-Shopify-Access-Token': this.token},
        body: JSON.stringify({query, variables}),
      },
    );
    if (!r.ok) throw Error(`Shopify HTTP ${r.status}`);
    const j = await r.json();
    if (j.errors) throw Error(JSON.stringify(j.errors));
    return j.data;
  }
  async snapshot() {
    const data = await this.gql(
      'query($id:ID!,$location:ID!){inventoryItem(id:$id){id tracked inventoryLevel(locationId:$location){quantities(names:["available"]){name quantity}} variant{id sku price inventoryPolicy product{id handle}}}}',
      {id: this.e.INVENTORY_ITEM_ID, location: this.e.LOCATION_ID},
    );
    if (!data.inventoryItem || data.inventoryItem.variant.id !== this.e.VARIANT_ID)
      throw Error('Fixture mapping mismatch');
    return {store: this.e.SHOPIFY_DOMAIN, location: this.e.LOCATION_ID, item: data.inventoryItem};
  }
  async discountSnapshot() {
    const data = await this.gql(
      `query($id:ID!){codeDiscountNode(id:$id){id codeDiscount{... on DiscountCodeBasic{status startsAt endsAt usageLimit appliesOncePerCustomer codes(first:2){nodes{code}} minimumRequirement{... on DiscountMinimumSubtotal{greaterThanOrEqualToSubtotal{amount currencyCode}}} customerGets{value{... on DiscountPercentage{percentage}} items{... on DiscountProducts{products(first:5){nodes{id handle}} productVariants(first:5){nodes{id}}}}} combinesWith{orderDiscounts productDiscounts shippingDiscounts}}}}}`,
      {id: this.e.DISCOUNT_ID},
    );
    const discount = data.codeDiscountNode?.codeDiscount;
    const codes = discount?.codes?.nodes.map(n => n.code);
    const products = discount?.customerGets?.items?.products?.nodes.map(n => n.handle);
    const amount = discount?.minimumRequirement?.greaterThanOrEqualToSubtotal;
    if (
      codes?.length !== 1 ||
      codes[0] !== this.e.DISCOUNT_CODE ||
      products?.length !== 1 ||
      products[0] !== this.e.OFFER_HANDLE ||
      amount?.currencyCode !== 'USD'
    )
      throw Error('Fixture mapping mismatch');
    const {minimumRequirement, ...unchanged} = discount;
    return {
      store: this.e.SHOPIFY_DOMAIN,
      id: this.e.DISCOUNT_ID,
      code: codes[0],
      minimum: Number(amount.amount),
      percentage: Math.round(discount.customerGets.value.percentage * 100),
      unchanged,
    };
  }
  // Shopify offers no compare-and-set here, so a concurrent edit between this read and the write is not excluded.
  async applyCouponMinimum(c) {
    const now = await this.discountSnapshot();
    if (JSON.stringify(now) !== JSON.stringify(c.before)) throw Error('CONFLICT: snapshot changed');
    const r = await this.gql(
      'mutation($id:ID!,$input:DiscountCodeBasicInput!){discountCodeBasicUpdate(id:$id,basicCodeDiscount:$input){userErrors{code field message}}}',
      {
        id: this.e.DISCOUNT_ID,
        input: {minimumRequirement: {subtotal: {greaterThanOrEqualToSubtotal: c.target.toFixed(2)}}},
      },
    );
    if (r.discountCodeBasicUpdate.userErrors.length)
      throw Error(JSON.stringify(r.discountCodeBasicUpdate.userErrors));
    const after = await this.discountSnapshot();
    if (after.minimum !== c.target || JSON.stringify(after.unchanged) !== JSON.stringify(c.before.unchanged))
      throw Error('Write read-back mismatch');
    return after;
  }
  async apply(c) {
    const now = await this.snapshot();
    if (JSON.stringify(now) !== JSON.stringify(c.before)) throw Error('CONFLICT: snapshot changed');
    const r = await this.gql(
      'mutation($input:InventorySetQuantitiesInput!,$key:String!){inventorySetQuantities(input:$input) @idempotent(key:$key){userErrors{code message}}}',
      {
        key: c.hash,
        input: {
          name: 'available',
          reason: 'correction',
          referenceDocumentUri: `fix-room://${c.id}/v${c.version}`,
          quantities: [
            {
              inventoryItemId: this.e.INVENTORY_ITEM_ID,
              locationId: this.e.LOCATION_ID,
              quantity: c.target,
              changeFromQuantity: c.before.item.inventoryLevel.quantities[0].quantity,
            },
          ],
        },
      },
    );
    if (r.inventorySetQuantities.userErrors.length)
      throw Error(JSON.stringify(r.inventorySetQuantities.userErrors));
    const after = await this.snapshot();
    if (after.item.inventoryLevel.quantities[0].quantity !== c.target)
      throw Error('Write read-back mismatch');
    return after;
  }
}
