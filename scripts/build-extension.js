const builder = require("../frontend/client/scripts/build-extension.js");
if (require.main === module) builder.build();
module.exports = builder;
