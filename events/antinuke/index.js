const main = require('./main');

module.exports = {
    name: 'ready',
    once: true,
    
    execute(client) {
        main.init(client);
    }
};

