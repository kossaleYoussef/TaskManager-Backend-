const express = require('express');
const app = express();
const { mongoose } = require('./db/mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

// load in mongoose Models
const { List } = require('./db/models/list.model');
const { Task } = require('./db/models/task.model');
const { User } = require('./db/models/user.model');

//load body-parser middleware
app.use(bodyParser.json());
app.use(cors());

//fix CORS 
/*app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, HEAD, PUT, DELETE, PATCH, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});*/

// Route Handelers

// List of routes
app.get('/lists',(req, res) => {
    // return an array of all the lists in the database
    List.find({}).then((lists) => {
        res.send(lists);
    });
});

app.post('/lists',(req, res) => {
    // create a new list and return the new changes to the user
    let title = req.body.title;
    let newList = new List({
        title
    });

    newList.save().then((listDoc) => {
        res.send(listDoc);
    }) 
});

app.patch('/lists/:id',(req, res) => {
    // update a specified list
    List.findByIdAndUpdate({_id: req.params.id}, {
        $set: req.body
    }).then(() => {
        res.sendStatus(200);
    });
});

app.delete('/lists/:id',(req, res) => {
    // delete a specified list
    List.findOneAndRemove({_id: req.params.id}).then((removedListDoc) => {
        res.send(removedListDoc);
    })
});

app.get('/lists/:listId/tasks', (req, res) => {
    // return all tasks on a specific list
    Task.find({
        _listId: req.params.listId
    }).then((tasks) => {
        res.send(tasks);
    })
});

app.post('/lists/:listId/tasks', (req, res) => {
    // create a new task in a specific list
    let newTask = new Task({
        title: req.body.title,
        _listId: req.params.listId
    });

    newTask.save().then((newTaskDoc) => {
        res.send(newTaskDoc);
    });
});

app.patch('/lists/:listId/tasks/:taskId', (req, res) => {
    // Update an existing task
    Task.findOneAndUpdate({
        _listId: req.params.listId,
        _id: req.params.taskId
    } , {
        $set: req.body
    }).then(() => {
        res.send({message: 'Updated successfully !'});
        //res.send(req.body);
    });
});

app.delete('/lists/:listId/tasks/:taskId', (req, res) => {
    // Update an existing task
    Task.findOneAndRemove({
        _listId: req.params.listId,
        _id: req.params.taskId
    }).then((taskDoc) => {
        res.send(taskDoc);
    });
});

// User Roots

    // Sign up Root
    app.post('/users', (req, res) => {
        let body = req.body;
        let newUser = new User(body);

        newUser.save().then(()=>{
            return newUser.createSession();
        }).then((refreshToken) => {
            return newUser.generateAccessAuthToken().then((accessToken) => {
                return {accessToken,refreshToken};
            });
        }).then((authTokens) => {
            res.header('x-refresh-token', authTokens.refreshToken);
            res.header('x-access-token', authTokens.accessToken);
            res.send(newUser);
        }).catch((e)=> {
            res.status(400).send(e);
        })
    });

    // Login root
    app.post('/users/login', (req, res) => {
        let username = req.body.username;
        let password = req.body.password;
    });


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});