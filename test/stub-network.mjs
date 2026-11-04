// Preloaded into the worker under test: answers the model and Shopify hosts, which the worker addresses directly.
const realFetch = globalThis.fetch;
let available = 0;
let minimum = '50.0';
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});

globalThis.fetch = async (url, options) => {
  const {hostname, pathname} = new URL(url);
  if (hostname === 'api.anthropic.com')
    return json({error: 'stubbed'}, Number(process.env.STUB_MODEL_STATUS));
  if (hostname !== process.env.SHOPIFY_DOMAIN) return realFetch(url, options);
  if (pathname.endsWith('/oauth/access_token')) return json({access_token: 'stub'});
  const {query, variables} = JSON.parse(options.body);
  if (query.includes('discountCodeBasicUpdate')) {
    minimum = variables.input.minimumRequirement.subtotal.greaterThanOrEqualToSubtotal;
    return json({data: {discountCodeBasicUpdate: {userErrors: []}}});
  }
  if (query.includes('codeDiscountNode')) {
    return json({
      data: {
        codeDiscountNode: {
          codeDiscount: {
            status: 'ACTIVE',
            codes: {nodes: [{code: process.env.DISCOUNT_CODE}]},
            minimumRequirement: {greaterThanOrEqualToSubtotal: {amount: minimum, currencyCode: 'USD'}},
            customerGets: {
              value: {percentage: 0.2},
              items: {products: {nodes: [{handle: process.env.OFFER_HANDLE}]}},
            },
          },
        },
      },
    });
  }
  if (query.includes('inventorySetQuantities')) {
    available = variables.input.quantities[0].quantity;
    return json({data: {inventorySetQuantities: {userErrors: []}}});
  }
  return json({
    data: {
      inventoryItem: {
        id: process.env.INVENTORY_ITEM_ID,
        tracked: true,
        inventoryLevel: {quantities: [{name: 'available', quantity: available}]},
        variant: {
          id: process.env.VARIANT_ID,
          sku: 'SKU',
          price: '12.00',
          inventoryPolicy: 'DENY',
          product: {id: 'product', handle: process.env.PRODUCT_HANDLE},
        },
      },
    },
  });
};
