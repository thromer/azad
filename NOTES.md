## reverse engineering

Working up from `order_details.extractDetailPromise`
* `order_impl._extractOrder`
* `order.getOrdersByYear`, `order.getOrdersByRange`
* `inject.fetchAndShowOrdersByYears`, `inject.fetchAndShowOrdersByRange`
* Nope: `inject.fetchShowAndSendItemsByRange`, ...
* `inject.handleMessageFromBackgroundToRootContentPage`

Working down from `control.handleMonthsClick`
* send `scrape_range` message to content (`inject.ts`)
* `inject.fetchAndShowOrdersByRange`

Display, working from top (bottom middle) ...
* radio button value managed by `settings` -- key `SETTINGS_KEY === "azad_table_type"`values `azad_show{orders,items,shipments,transactions}`

* `inject.fetchAndShowOrders*`
* `table.display`
* `table.reallyDisplay`

Probably not
* `table.displayTransactions`
* `table.reallyDisplayTransactions`



TBD how does get items work? Not like this, seems to also use fetchAndShowOrders. Maybe it is just about display at the end.
* `popup.html` `azad_show_items` radio button (and `azad_show_orders`)
* ... I don't see how either radio button is actually used :(
* send `scrape_range_and_dump_items` message to content
* `inject.fetchShowAndSendItemsByRange`
