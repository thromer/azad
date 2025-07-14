import { readFileSync } from 'fs'
import { JSDOM} from 'jsdom'
import { extractDetailPromise } from '../js/order_details'
import { IOrderHeader } from '../js/order_header'

async function main() {
  const htmlPath = process.argv[2]
  if (!htmlPath) {
    console.error(`Usage: ${process.argv[1]} <htmlPath>`)
    process.exit(1)
  }

  // Real header comes from (more or less) order_list_page:reallyTranslateOrdersPage -> order_header:reallyExtractOrderHeader
  const header: IOrderHeader = {} as IOrderHeader  // TODO
  try {
    const orderDetail = await extractDetailPromise(header, new JSDOM(readFileSync(htmlPath)).window.document)
    console.log(JSON.stringify(orderDetail, null, 2))
  } catch (e) {
    console.error('Error parsing order details:', (e as Error).message)
    process.exit(1)
  }
}

(async () => {
  await main();
})()


