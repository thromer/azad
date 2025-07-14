const webpack = require("webpack");
const config = require("../webpack.config");

delete config.chromeExtensionBoilerplate;

// Increase Node.js heap size for webpack build
process.env.NODE_OPTIONS = '--max-old-space-size=4096';

// Force garbage collection more aggressively
if (global.gc) {
    global.gc();
}

const compiler = webpack(config);

compiler.run((err, stats) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    
    if (stats.hasErrors()) {
        console.error(stats.toString({ colors: true }));
        process.exit(1);
    }
    
    console.log(stats.toString({ colors: true }));
    
    // Clean up compiler to free memory
    compiler.close((closeErr) => {
        if (closeErr) {
            console.error(closeErr);
        }
        
        // Force garbage collection after build
        if (global.gc) {
            global.gc();
        }
        
        process.exit(0);
    });
});
