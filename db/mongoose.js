// this file will handle connections to the MongoDb database

const mongoose = require('mongoose');

// set global promise instead of bluebird promise
mongoose.Promise = global.Promise;

mongoose.connect('mongodb://localhost:27017/TaskManager', {useNewUrlParser: true}).then(()=> {
    console.log('connected successfully to mongoDB');
}).catch((e)=> {
    console.log("error while attempting to connect to database " + e);
});


// Prevent deprectation warnings (from mongoDB driver)
mongoose.set('useCreateIndex', true);
mongoose.set('useFinfAndModify', false);


module.exports = { mongoose };