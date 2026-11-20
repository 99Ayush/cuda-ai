const builder = require("../apps/web/scripts/build-extension.js");
if (require.main === module) builder.build();
module.exports = builder;
