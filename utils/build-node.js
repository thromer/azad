const webpack = require("webpack");
const config = require("../webpack.config");

// Extract just the node_options configuration (second element in the array)
const nodeConfig = config[1];

webpack(
    nodeConfig,
    function (err) { if (err) throw err; }
);
