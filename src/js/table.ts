/* Copyright(c) 2016-2021 Philip Mulcahy. */

const $ = require('jquery');
import 'datatables';
import * as azad_entity from './entity';
import * as azad_item from './item';
import * as azad_order from './order';
import * as csv from './csv';
import * as diagnostic_download from './diagnostic_download';
import * as notice from './notice';
import * as progress_bar from './progress_bar';
import * as settings from './settings';
import * as sprintf from 'sprintf-js';
import * as stats from './statistics';
import * as urls from './url';
import * as util from './util';

'use strict';

const CELL_CLASS = 'azad_cellClass ';
const ELEM_CLASS = 'azad_elemClass ';
const LINK_CLASS = 'azad_linkClass ';
const TH_CLASS = 'azad_thClass ';

let datatable: any = null;
const order_map: Record<string, azad_order.IOrder> = {};
let progress_indicator: progress_bar.IProgressIndicator|null = null;

/**
 * Add a td to the row tr element, and return the td.
 */
const addCell = function(row: HTMLTableRowElement, value: string|null) {
    const td = row.ownerDocument.createElement('td');
    td.setAttribute('class', CELL_CLASS);
    row.appendChild(td);
    td.textContent = value;
    return td;
};

/**
 * Add a td to the row tr element, and return the td.
 */

const addElemCell = function(
        row: HTMLElement,
        elem: HTMLElement
): HTMLElement {
    const td: HTMLTableDataCellElement = row.ownerDocument!.createElement('td');
    td.setAttribute('class', ELEM_CLASS);
    row.appendChild(td);
    td.appendChild(elem);
    return td;
};

const TAX_HELP = 'Caution: tax is often missing when not supplied by Amazon, cancelled, or pre-order.';

interface ColSpec {
    field_name: string;

    // Yes: using IEntity here means a tonne of downcasting in the implementations.
    // The alternatives seem (to me) worse.
    render_func?: (entity: azad_entity.IEntity, td: HTMLElement) => Promise<null>;

    is_numeric: boolean;
    value_promise_func_name?: string;
    help?: string;
    sites?: RegExp;
    visibility?: () => Promise<boolean>;
    sum?: number;
    pageSum?: number;
};

const ORDER_COLS: ColSpec[] = [
    {
        field_name: 'order id',
        render_func:
            (order: azad_entity.IEntity, td: HTMLElement) => (order as azad_order.IOrder).id().then(
                id => (order as azad_order.IOrder).detail_url().then(
                    url => {
                        td.innerHTML = '<a href="' + url + '">' + id + '</a>';
                        return null;
                    }
                )
            ),
        is_numeric: false
    },
    {
        field_name: 'items',
        render_func: (order: azad_entity.IEntity, td: HTMLElement) => 
            (order as azad_order.IOrder).items().then( items => {
                const ul = td.ownerDocument!.createElement('ul');
                for(let title in items) {
                    if (Object.prototype.hasOwnProperty.call(items, title)) {
                        const li = td.ownerDocument!.createElement('li');
                        ul.appendChild(li);
                        const a = td.ownerDocument!.createElement('a');
                        li.appendChild(a);
                        a.textContent = title + '; ';
                        a.href = items[title];
                    }
                }
                td.textContent = '';
                td.appendChild(ul);
                return null;
            }),
        is_numeric: false
    },
    {
        field_name: 'to',
        value_promise_func_name: 'who',
        is_numeric: false
    },
    {
        field_name: 'date',
        value_promise_func_name: 'date',
        is_numeric: false,
    },
    {
        field_name: 'total',
        value_promise_func_name: 'total',
        is_numeric: true
    },
    {
        field_name: 'shipping',
        value_promise_func_name: 'postage',
        is_numeric: true,
        help: 'If there are only N/A values in this column, your login session may have partially expired, meaning you (and the extension) cannot fetch order details. Try clicking on one of the order links in the left hand column and then retrying the extension button you clicked to get here.'
    },
    {
        field_name: 'shipping_refund',
        value_promise_func_name: 'postage_refund',
        is_numeric: true,
        help: 'If there are only N/A values in this column, your login session may have partially expired, meaning you (and the extension) cannot fetch order details. Try clicking on one of the order links in the left hand column and then retrying the extension button you clicked to get here.'
    },
    {
        field_name: 'gift',
        value_promise_func_name: 'gift',
        is_numeric: true
    },
    {
        field_name: 'reward',
        value_promise_func_name: 'reward',
        is_numeric: true
    },
    {
        field_name: 'credit',
        value_promise_func_name: 'credit',
        is_numeric: true
    },
    {
        field_name: 'VAT',
        value_promise_func_name: 'vat',
        is_numeric: true,
        help: TAX_HELP,
        sites: new RegExp('amazon(?!.com)')
    },
    {
        field_name: 'tax',
        value_promise_func_name: 'us_tax',
        is_numeric: true,
        help: TAX_HELP,
        sites: new RegExp('\\.com$')
    },
    {
        field_name: 'GST',
        value_promise_func_name: 'gst',
        is_numeric: true,
        help: TAX_HELP,
        sites: new RegExp('\\.ca$')
    },
    {
        field_name: 'PST',
        value_promise_func_name: 'pst',
        is_numeric: true,
        help: TAX_HELP,
        sites: new RegExp('\\.ca$')
    },
    {
        field_name: 'refund',
        value_promise_func_name: 'refund',
        is_numeric: true
    },
    {
        field_name: 'payments',
        render_func: (order: azad_entity.IEntity, td: HTMLElement) => {
            return (order as azad_order.IOrder).payments().then( payments => {
                const ul = td.ownerDocument!.createElement('ul');
                td.textContent = '';
                payments.forEach( (payment: any) => {
                    const li = document.createElement('li');
                    ul.appendChild(li);
                    const a = document.createElement('a');
                    li.appendChild(a);
                    // Replace unknown/none with "-" to make it look uninteresting.
                    if (!payment) {
                        a.textContent = '-'
                    } else {
                        a.textContent = payment + '; '
                    }
                   (order as azad_order.IOrder).detail_url().then(
                        detail_url => a.setAttribute( 'href', detail_url)
                    );
                });
                if(datatable) {
                    datatable.rows().invalidate();
                    datatable.draw();
                }
                td.appendChild(ul);
                return null;
            });
        },
        is_numeric: false
    },
    {
        field_name: 'invoice',
        render_func: (order: azad_entity.IEntity, td: HTMLElement) => {
            return (order as azad_order.IOrder).invoice_url().then( url => {
                if ( url ) {
                    const link = td.ownerDocument!.createElement('a');
                    link.textContent = url;
                    link.setAttribute('href', url);
                    td.textContent = '';
                    td.appendChild(link);
                } else {
                    td.textContent = '';
                }
                return null;
            });
        },
        is_numeric: false,
        visibility: () => settings.getBoolean('show_invoice_links')
    }
];

const ITEM_COLS: ColSpec[] = [
    {
        field_name: 'order id',
        render_func:
            (entity: azad_entity.IEntity, td: HTMLElement): Promise<null> => {
                const item = entity as azad_item.IItem;
                td.innerHTML = '<a href="' + item.order_detail_url +
                               '">' + item.order_id + '</a>';
                return Promise.resolve(null);
            },
        is_numeric: false
    }, {
        field_name: 'quantity',
        value_promise_func_name: 'quantity',
        is_numeric: false
    }, {
        field_name: 'description',
        render_func: (entity: azad_entity.IEntity, td: HTMLElement): Promise<null> => {
                const item = entity as azad_item.IItem;
                td.innerHTML = '<a href="' + item.url +
                               '">' + item.description + '</a>';
                return Promise.resolve(null);
            },
        is_numeric: false
    }, {
        field_name: 'price',
        value_promise_func_name: 'price',
        is_numeric: false
    }
];

function getCols(
    items_not_orders: boolean
): Promise<ColSpec[]> {
    const waits: Promise<any>[] = [];
    const results: ColSpec[] = [];  
    const cols = items_not_orders ? ITEM_COLS : ORDER_COLS;
    cols.forEach( col => {
        if (col?.sites?.test(urls.getSite()) ?? true) {
            const visible_promise = col.visibility ?
                col.visibility() :
                Promise.resolve(true);
            waits.push(visible_promise);
            visible_promise.then( visible => {
                if ( visible ) {
                    results.push( col );
                }
            });
        }
    });
    return Promise.all(waits).then( _ => results );
}

function maybe_promise_to_promise(
    field: azad_entity.Field
): Promise<azad_entity.Value> {    
    const called = 
        typeof(field) === 'function' ?
            (field as ()=>Promise<azad_entity.Value>)() :
            field;
    const promise = typeof(called) === 'object' && 'then' in called ?
        called :
        Promise.resolve(called);
    return promise;
}

function extract_value(
    entity: azad_entity.IEntity,
    field_name: string
): Promise<azad_entity.Value> {
    const field: azad_entity.Field = 'id' in entity ?
        (entity as azad_order.IOrder)[field_name as keyof azad_order.IOrder] :
        (entity as azad_item.IItem)[field_name as keyof azad_item.IItem]
    return maybe_promise_to_promise(field);
}

function appendCell(
    tr: HTMLTableRowElement,
    entity: azad_entity.IEntity,
    col_spec: ColSpec,
): Promise<null> {
    const td = document.createElement('td')
    td.textContent = 'pending';
    tr.appendChild(td);
    const null_converter = function(x: any): any {
        if (x) {
            if (
                typeof(x) === 'string' &&
                parseFloat(x.replace(/^([£$]|CAD|EUR|GBP) */, '')
                            .replace(/,/, '.')
                          ) + 0 == 0
            ) {
                return 0;
            } else {
                return x;
            }
        } else if (x == 0) {
            return 0;
        } else {
            return '';
        }
    }
    const value_written_promise: Promise<null> =
        col_spec.render_func ?
            col_spec?.render_func(entity, td) :
            (() => {
                const field_name = col_spec.value_promise_func_name;
                const callable_or_value: (()=>Promise<string|number>)|number|string = ('id' in entity) ?
                    (entity as azad_order.IOrder)[
                        field_name as keyof azad_order.IOrder
                    ]:
                    (entity as azad_item.IItem)[
                        field_name as keyof azad_item.IItem
                    ];
                const value_promise: Promise<number|string> = (
                    typeof(callable_or_value) === 'function'
                ) ?
                    callable_or_value.bind(entity)() :
                    Promise.resolve(callable_or_value)
                return value_promise
                    .then(null_converter)
                    .then(
                        (value: string) => {
                            td.innerText = value;
                            if(datatable) {
                                datatable.rows().invalidate();
                                datatable.draw();
                            }
                            return null;
                        }
                    ); 
            })();
    td.setAttribute('class', td.getAttribute('class') + ' ' +
            'azad_col_' + col_spec.field_name + ' ' +
            'azad_numeric_' + (col_spec.is_numeric ? 'yes' : 'no' ) + ' ');
    if (col_spec.help) {
        td.setAttribute(
            'class',
            td.getAttribute('class') + 'azad_elem_has_help '
        );
        td.setAttribute('title', col_spec.help);
    }
    // order.id().then( id => {
    //     if (id == '203-4990948-9075513' && col_spec.field_name == 'postage') {
    //         value_written_promise.then(() => console.log('written promise resolved'));
    //     }
    // })
    return value_written_promise;
}

function appendEntityRow(
    table: HTMLElement,
    entity: azad_entity.IEntity,
    cols: Promise<ColSpec[]>
): Promise<Promise<null>[]> {
    if ('id' in entity) {
        const order = entity as azad_order.IOrder;
        order.id().then(
            id => { order_map[id] = order; }
        );
    }
    const tr = document.createElement('tr');
    table.appendChild(tr);
    return cols.then( cols =>
        cols.map( col_spec => appendCell(tr, entity, col_spec) )
    );
}

function addOrderTable(
    doc: HTMLDocument,
    orders: azad_order.IOrder[],
    wait_for_all_values_before_resolving: boolean,
    cols: Promise<ColSpec[]>
): Promise<HTMLTableElement> {
    return addTable(doc, orders, wait_for_all_values_before_resolving, cols);
}

function addItemTable(
    doc: HTMLDocument,
    orders: azad_order.IOrder[],
    wait_for_all_values_before_resolving: boolean,
    cols: Promise<ColSpec[]>
): Promise<HTMLTableElement> {
    const item_promises = ordersToItems(orders);
    return item_promises.then(
        items => addTable(
            doc, items, wait_for_all_values_before_resolving, cols)
    )
}

function addTable(
    doc: HTMLDocument,
    entities: azad_entity.IEntity[],
    wait_for_all_values_before_resolving: boolean,
    cols: Promise<ColSpec[]>
): Promise<HTMLTableElement> {
    const addHeader = function(row: HTMLElement, value: string, help: string) {
        const th = row.ownerDocument!.createElement('th');
        th.setAttribute('class', TH_CLASS);
        row.appendChild(th);
        th.textContent = value;
        if( help ) {
            th.setAttribute(
                'class', th.getAttribute('class') + 'azad_th_has_help ');
            th.setAttribute('title', help);
        }
        return th;
    };

    // remove any old table
    let table: HTMLTableElement = <HTMLTableElement>doc.querySelector(
        '[id="azad_order_table"]'
    );
    if ( table !== null ) {
        console.log('removing old table');
        table.parentNode!.removeChild(table);
        console.log('removed old table');
    }
    console.log('adding table');
    table = <HTMLTableElement>doc.createElement('table');
    console.log('added table');
    document.body.appendChild(table);
    table.setAttribute('id', 'azad_order_table');
    table.setAttribute(
        'class', 'azad_table stripe compact hover order-column ');

    const thead = doc.createElement('thead');
    thead.setAttribute('id', 'azad_order_table_head');
    table.appendChild(thead);

    const hr = doc.createElement('tr');
    hr.setAttribute('id', 'azad_order_table_hr');
    thead.appendChild(hr);

    const tfoot = doc.createElement('tfoot');
    tfoot.setAttribute('id', 'azad_order_table_foot');
    table.appendChild(tfoot);

    const fr = doc.createElement('tr');
    fr.setAttribute('id', 'azad_order_table_fr');
    tfoot.appendChild(fr);

    return cols.then( actual_cols => {
        actual_cols.forEach( col_spec => {
            addHeader(hr, col_spec.field_name, col_spec?.help ?? '');
            addHeader(fr, col_spec.field_name, col_spec?.help ?? '');
        });

        const tbody = doc.createElement('tbody');
        table.appendChild(tbody);

        // Record all the promises: we're going to need to wait on all of them
        // to resolve before we can hand over the table to our callers.
        const row_done_promises = entities.map( entity => {
            return appendEntityRow(tbody, entity, cols);
        });

        if (wait_for_all_values_before_resolving) {
            return Promise.all(row_done_promises).then( row_promises => {
                const value_done_promises: Promise<null>[] = [];
                row_promises.forEach(
                    cell_done_promises => value_done_promises.push(
                        ...cell_done_promises
                    )
                )
                console.log(
                    'value_done_promises.length',
                    value_done_promises.length
                );
                return Promise.all(value_done_promises).then( _ => table );
            });

        } else {
            return table;
        }
    });
}

function ordersToItems(orders: azad_order.IOrder[]): Promise<azad_item.IItem[]>
{
    return Promise.all(orders.map(order => order.item_list())).then(
        itemss => {
            const items: azad_item.IItem[] = [];
            itemss.forEach( order_items => items.push(...order_items) );
            return items;
        }
    );
}

function reallyDisplay(
    orders: azad_order.IOrder[],
    beautiful: boolean,
    wait_for_all_values_before_resolving: boolean,
    items_not_orders: boolean,
): Promise<HTMLTableElement> {
    console.log('amazon_order_history_table.reallyDisplay starting');
    for (let entry in order_map) {
        delete order_map[entry];
    }
    util.clearBody();
    const order_promises = orders.map(
        (order: azad_order.IOrder) => Promise.resolve(order)
    );
    const cols = getCols(items_not_orders);
    const table_promise = items_not_orders ?
        addItemTable(
            document, orders, wait_for_all_values_before_resolving, cols) :
        addOrderTable(
            document, orders, wait_for_all_values_before_resolving, cols);
    table_promise.then( _ => {
        if (beautiful) {
            $(document).ready( () => {
                if (datatable) {
                    datatable.destroy();
                }
                addProgressBar();
                util.removeButton('data table');
                util.addButton(
                    'plain table',
                    function() { display(order_promises, false, false); },
                    'azad_table_button'
                );
                addCsvButton(order_promises)
                datatable = (<any>$('#azad_order_table')).DataTable({
                    'bPaginate': true,
                    'lengthMenu': [ [10, 25, 50, 100, -1],
                        [10, 25, 50, 100, 'All'] ],
                    'footerCallback': function() {
                        const api = this.api();
                        // Remove the formatting to get integer data for summation
                        const floatVal = (v: string | number): number => {
                            const parse = (i: string | number) => {
                                try {
                                    if(typeof i === 'string') {
                                        return (i === 'N/A' || i === '-' || i === 'pending') ?
                                            0 :
                                            parseFloat(
                                                i.replace(/^([£$]|CAD|EUR|GBP) */, '')
                                                 .replace(/,/, '.')
                                            );
                                    }
                                    if(typeof i === 'number') { return i; }
                                } catch (ex) {
                                    console.warn(ex);
                                }
                                return 0;
                            };
                            const candidate = parse(v);
                            if (isNaN(candidate)) {
                                return 0;
                            }
                            return candidate;
                        };
                        let col_index = 0;
                        cols.then( cols => cols.forEach( col_spec => {
                            const sum_col = function(col: any) {
                                const data = col.data();
                                if (data) {
                                    const sum = data
                                        .map( (v: string | number) => floatVal(v) )
                                        .reduce( (a: number, b: number) => a + b, 0 );
                                    return floatVal(sum);
                                } else {
                                    return 0;
                                }
                            }
                            if(col_spec.is_numeric) {
                                col_spec.sum = sum_col(api.column(col_index));
                                col_spec.pageSum = sum_col(
                                    api.column(col_index, { page: 'current' }));
                                $(api.column(col_index).footer()).html(
                                    sprintf.sprintf('page=%s; all=%s',
                                        col_spec.pageSum.toFixed(2),
                                        col_spec.sum.toFixed(2))
                                );
                            }
                            col_index += 1;
                        }));
                    }
                });
            });
        } else {
            addProgressBar();
            util.removeButton('plain table');
            util.addButton(
                'data table',
                function() { display(order_promises, true, false); },
                'azad_table_button'
            );
            addCsvButton(order_promises)
        }
    });

    console.log('azad.reallyDisplay returning');
    return table_promise;
}

function addProgressBar(): void {
    progress_indicator = progress_bar.addProgressBar(document.body)
}

function addCsvButton(orders: Promise<azad_order.IOrder>[]): void {
    const title = "download spreadsheet ('.csv')";
    util.addButton(	
       title,
       function() {	
           display(orders, false, true).then(
               table => settings.getBoolean('show_totals_in_csv').then(
                   show_totals => csv.download(table, show_totals)
               )
           );
       },
       'azad_table_button'	
    );
}

// TODO: refactor so that order retrieval belongs to azad_table, but
// diagnostics building belongs to azad_order.
export function display(
    orderPromises: Promise<azad_order.IOrder>[],
    beautiful: boolean,
    wait_for_all_values_before_resolving: boolean
): Promise<HTMLTableElement> {
    console.log('amazon_order_history_table.display starting');
    return Promise.allSettled(orderPromises).then( settled => {
        const orders: azad_order.IOrder[] = settled
            .filter(s => s.status == 'fulfilled')
            .map(s => (s as PromiseFulfilledResult<azad_order.IOrder>).value);
        const problems: any[] = settled
            .filter(s => s.status == 'rejected')
            .map(s => (s as PromiseRejectedResult).reason);
        problems.forEach(p => console.warn('Bad order: ' + JSON.stringify(p)));
        console.log('amazon_order_history_table.display then func starting');
        return settings.getBoolean('show_items_not_orders').then(
            items_not_orders => {
                const table_promise: Promise<HTMLTableElement> = reallyDisplay(
                    orders,
                    beautiful,
                    wait_for_all_values_before_resolving,
                    items_not_orders
                );
                console.log(
                    'amazon_order_history_table.display then func returning ' +
                    'table promise.'
                );
                return table_promise;
            }
        );
    });
    console.log('amazon_order_history_table.display returning');
}

export function dumpOrderDiagnostics(order_id: string) {
    console.log('dumpOrderDiagnostics: ' + order_id);
    const order = order_map[order_id];
    if (order) {
        const utc_today = new Date().toISOString().substr(0,10);
        const file_name = order_id + '_' + utc_today + '.json';
        order.assembleDiagnostics()
            .then(
                diagnostics => diagnostic_download.save_json_to_file(
                    diagnostics,
                    file_name
                )
            ).then(
                () => notice.showNotificationBar(
                    'Debug file ' + file_name + ' saved.',
                    document
                ),
                err => {
                    const msg = 'Failed to create debug file: ' + file_name +
                                ' ' + err;
                    console.warn(msg);
                    notice.showNotificationBar(msg, document);
                }
            );
    }
}

export function updateProgressBar(): void {
    if (progress_indicator) {
        const completed = stats.get('completed');
        const cache_hits = stats.get('cache_hits');
        const queued = stats.get('queued');
        const running = stats.get('running');
        if (completed!=null && queued!=null && running!=null) {
           const ratio: number = (completed + cache_hits) / (completed + queued + running + cache_hits);
           if (ratio) {
               progress_indicator.update_progress(ratio);
           }
        }
    }
}
