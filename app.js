const express = require('express');
const app = express();
const { mongoose } = require('./db/mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');

// load in mongoose Models
const { List } = require('./db/models/list.model');
const { Task } = require('./db/models/task.model');
const { User } = require('./db/models/user.model');

//load body-parser middleware
app.use(bodyParser.json());
app.use(cors());
app.use(function(req, res, next) {
    res.header('Access-Control-Expose-Headers','x-access-token, x-refresh-token');
    next();
});

// check validity of JWT
let authenticate = (req, res, next) => {
    let token = req.header('x-access-token');
    jwt.verify(token, User.getJWTSecret(), (err, decoded) => {
        if(err) {
            //jwt invalid - do not authenticate
            res.status(401).send(err);
        }else{
            //jwt is valid
            req.user_id = decoded._id;
            next();
        }
    });
}

// Verefie refresh token middleware
let verifySession = (req, res, next )=> {
    let refreshToken = req.header('x-refresh-token');
    let _id = req.header('_id');
    User.findByIdAndToken(_id,refreshToken).then((user) => {
        if(!user) {
            // user not found
            return Promise.reject({
                'error': 'User not Found ! make sure that refresh token and user id are valid !'
            });
        }

        // user was found
        req.user_id = user._id;
        req.refreshToken = refreshToken;
        req.userObject = user;
        let isSessionValid = false;
        

        user.sessions.forEach((session) => {
           if(session.token === refreshToken) {
               // check if session has expired
               if(User.hasRefreshTokenExpired(session.expiresAt) === false){
                    isSessionValid= true;
               }
           }
        });

        if(isSessionValid) {
            next();
        }else{
            return Promise.reject({
                'error': 'Refresh token has expired or the session is invalid'
            })
        }
    }).catch((e)=> {
        res.status(401).send(e);
    })
}

//fix CORS 
/*app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, HEAD, PUT, DELETE, PATCH, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});*/

// Route Handelers

// List of routes
app.get('/lists', authenticate, (req, res) => {
    // return an array of all the lists in the database that belong to the authenticated user
    List.find({
        _userId: req.user_id
    }).then((lists) => {
        res.send(lists);
    });
});

app.post('/lists', authenticate, (req, res) => {
    // create a new list and return the new changes to the user
    let title = req.body.title;
    let newList = new List({
        title,
        _userId: req.user_id
    });

    newList.save().then((listDoc) => {
        res.send(listDoc);
    }) 
});

app.patch('/lists/:id', authenticate, (req, res) => {
    // update a specified list
    List.findByIdAndUpdate({_id: req.params.id, _userId: req.user_id}, {
        $set: req.body
    }).then(() => {
        res.send({'message': 'List updated Successfully !'});
    });
});

app.delete('/lists/:id', authenticate, (req, res) => {
    // delete a specified list
    List.findOneAndRemove({_id: req.params.id, _userId: req.user_id}).then((removedListDoc) => {
        res.send(removedListDoc);
        //delete all tasks related to the list
        deleteTasksFromList(removedListDoc._id);
    })
});

app.get('/lists/:listId/tasks', authenticate, (req, res) => {
    // return all tasks on a specific list
    Task.find({
        _listId: req.params.listId
    }).then((tasks) => {
        res.send(tasks);
    })
});

app.post('/lists/:listId/tasks', authenticate,  (req, res) => {
    List.findOne({_id: req.params.listId, _userId: req.user_id}).then((list) => {
        if(list){
            // userObject is valid
            return true;
        }
        return false;
    }).then((canCreateTask) => {
        if(canCreateTask){
            // create a new task in a specific list
            let newTask = new Task({
            title: req.body.title,
            _listId: req.params.listId
            });

            newTask.save().then((newTaskDoc) => {
            res.send(newTaskDoc);
            });
        }else{
            res.sendStatus(404);
        }
    })

    
});

app.patch('/lists/:listId/tasks/:taskId', authenticate, (req, res) => {
    List.findOne({_id: req.params.listId, _userId: req.user_id}).then((list) => {
        if(list){
            // userObject is valid
            return true;
        }
        return false;
    }).then((canUpdateTask) => {
        if(canUpdateTask){
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
        }else{
            res.sendStatus(404);
        }
    })

});

app.delete('/lists/:listId/tasks/:taskId', authenticate, (req, res) => {
    List.findOne({_id: req.params.listId, _userId: req.user_id}).then((list) => {
        if(list){
            // userObject is valid
            return true;
        }
        return false;
    }).then((canDeleteTask) => {
        if(canDeleteTask){
            // Update an existing task
            Task.findOneAndRemove({
                _listId: req.params.listId,
                _id: req.params.taskId
            }).then((taskDoc) => {
                res.send(taskDoc);
            });
        }else{
            res.sendStatus(404);
        }
    })
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
        
        User.findByCords(username, password).then((user) => {
            return user.createSession().then((refreshToken) => {
                return user.generateAccessAuthToken().then((accessToken) => {
                    return {accessToken,refreshToken}
                });
            }).then((authTokens) => {
                res.header('x-refresh-token',authTokens.refreshToken);
                res.header('x-access-token', authTokens.accessToken);
                res.send(user);
            })
        }).catch((e) => {
            res.status(400).send(e);
        })
    });

    // generate Access token
    app.get('/users/me/access-token',verifySession , (req,res) => {
        req.userObject.generateAccessAuthToken().then((accessToken) => {
            res.header('x-access-token',accessToken).send({accessToken})
        }).catch((e)=> {
            res.status(400).send(e);
        })
    });

// Helper Methods

let deleteTasksFromList = (_listId)=> {
    Task.deleteMany({
        _listId
    }).then(()=> {
        console.log('Tasks related to this list are deleted');
    });
}


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});