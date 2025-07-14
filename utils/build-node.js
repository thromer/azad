const webpack = require("webpack");
const config = require("../webpack.config");

const nodeConfig = config.filter((e) => e.target === "node")
console.log(nodeConfig)
webpack(
    nodeConfig,
    function (err) { if (err) throw err; }
);
