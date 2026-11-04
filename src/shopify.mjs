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
