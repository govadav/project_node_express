//regularly registed users vertification and database for the report website 
var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');
var EhbReport = require("../models/ehb");
var Schema = mongoose.Schema;
// Schema

var userSchema = new Schema({

  firstname: {
    type: String
  },

  lastname: {
    type: String
  },

  username: {
      type: String,
      index: true
  },

  password: {
      type: String
  },

  email: {
      type: String
  },

  access: {
    type: Boolean,
    default: false
  },

  admin: {
      type: Boolean,
      default: false
  },

  reportIds: {
    type: Array,
    default: []
  },

  lms: {
    type: String,
    default: "None"
  }

});

var User = module.exports =  mongoose.model('User', userSchema);

function changePermission (id, permission, callback){
  var query = {_id: id};
  User.update(query, permission, function(err){
    if(err) throw err;
    callback(null);
  });
}

module.exports.createUser = function(newUser, callback) {
  bcrypt.genSalt(10, function(err, salt) {
    bcrypt.hash(newUser.password, salt, function(err, hash) {
        newUser.password = hash;
        newUser.save(callback);
    });
  });
};

module.exports.getUserByUsername = function(username, callback){
  var query = {username: username};
  return User.findOne(query, callback);
};

module.exports.comparePassword = function(compPass, hash, callback){
  bcrypt.compare(compPass, hash, function(err, isMatch) {
    if(err) throw err;
    callback(null, isMatch);
  });
};

module.exports.getUserById = function(id, callback){
  User.findById(id, callback);
  console.log(id);
};

module.exports.getUsersList = function(callback){
  
  User.find({}, function(err, docs){
    if(err) throw err;
    callback(null, docs);    
  });
};

module.exports.updatePermissions = function(changes, callback){

  console.log(changes);

  for (var key in changes) {
    if(key.includes('admin-')) {
      
      var id = key.replace("admin-", "");
      
      if(changes[key] == 'on'){
        var permission = {admin: true};
      } else {
        var permission = {admin: false};
      }
    
    } else if (key.includes('access-')) {
      var id = key.replace("access-", "");

      if(changes[key] == 'on'){
        var permission = {access: true};
      } else {
        var permission = {access: false};
      }

    }

    changePermission(id, permission, function(err){
      if(err) throw err;
    });
  }
  callback(null);
};
  















