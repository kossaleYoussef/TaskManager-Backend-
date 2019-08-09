const mongoose = require('mongoose');
const _ = require('lodash');
const jwt = require('jsonwebtoken');
const jwtSecret = '654d54f64ds65gf4s6d54g56sd4654g654s5g4df5';
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        minlength: 3,
        trim: true,
        unique: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    sessions: [
        {
            token: {
                type: String,
                required: true
            },
            expiresAt: {
                type: Number,
                required: true
            }

        }
    ]
});

// instance Schema

    // Override toJson method which return the whole object
    UserSchema.methods.toJSON = function(){
        const user = this;
        const userObject = user.toObject();

        //return the document except the password and sessions
        return _.omit(userObject,['password','sessions']);
    }

    // genetrate access token
    UserSchema.methods.generateAccessAuthToken = function(){
        const user = this;
        return new Promise((resolve, reject) => {
            // Create the JSON web TOKEN and return it
            jwt.sign({_id: user._id.toHexString()},jwtSecret,{expiresIn: '15m'},(err,token)=>{
                if(!err){
                    resolve(token);
                }else{
                    reject();
                }
            });
        });
    }
    // generate refresh token
    UserSchema.methods.generateRefreshAuthToken = function(){
        //geberate 64byte hex string
        return new Promise((resolve, reject) => {
            crypto.randomBytes(64, (err, buf) => {
                if(!err){
                    let token = buf.toString('hex');
                    return resolve(token);
                }
            });
        });
    }

    //Create a Session
    UserSchema.methods.createSession = function(){
        let user = this;
        return user.generateRefreshAuthToken().then((refreshToken) => {
            return SaveSessionToDb(user,refreshToken);
        }).then((refreshToken) => {
            return refreshToken;
        }).catch((e) => {
            return Promise.reject('failed to save session to database'+ e);
        });
    }

// Model methods (static methods)   
    UserSchema.statics.findByIdAndToken = function(_id, token) {
        const user = this;
        return user.findOne({
            _id,
            'sessions.token': token
        });
    }
    UserSchema.statics.findByCords = function(username, password) {
        return user.findOne({username}).then((user) => {
            if(!user){
                return Promise.reject();
            }
            return new Promise((resolve, reject) => {
                bcrypt.compare(password, user.password, (err, res) => {
                    if(res){
                        resolve(user);
                    }else{
                        reject();
                    }
                });
            }); 
        });
    } 
    UserSchema.pre('save', function(next){
        let user = this;
        let costFactor = 10;
        if(user.isModified('password')){
            bcrypt.genSalt(costFactor, (err, salt) =>{
                bcrypt.hash(user.password, salt, (err, hash) => {
                    user.password = hash;
                    next();
                });
            })
        }else{
            next();
        }
    });
    UserSchema.statics.hasRefreshTokenExpired = (expiresAt) => {
        let secondsSinceEpoch = Date.now() / 1000;
        if(expiresAt> secondsSinceEpoch){
            return false;
        }else{
            return true;
        }
    }

    
// Help methods
    // Save session to database (refreshToken + expireTime)
    let SaveSessionToDb = (user, refreshToken) => {
        return new Promise((resolve, reject) => {
            let expiresAt = generateRefreshTokenExpiryTime();
            user.sessions.push({'token': refreshToken,'expiresAt': expiresAt});
            user.save().then(()=> {
                // session saved
                return resolve(refreshToken);
            }).catch((e) => {
                reject(e);
            });
        });
    }

    let generateRefreshTokenExpiryTime = ()=> {
        let daysUntilExpire = '10';
        let secondsUntilExpire = ((daysUntilExpire * 24) * 60) * 60;
        return ((Date.now()/1000)*secondsUntilExpire);
    }


const User = mongoose.model('User',UserSchema);
module.exports = { User };