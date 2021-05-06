//users registration page 
var express = require('express');
var router = express.Router();
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var mongoose = require('mongoose');

var User = require("../models/user")
//needs model user to check loggin in user credentials

router.get('/register', function(req, res){
  res.render('register');
});

router.get('/login', function(req, res){
  res.render('login');
});

router.get('/verify', ensureAdmin, function(req, res){
  User.getUsersList(function(err, users){
    if(err) throw err;
    res.render('verify', {users: users});
  });
});

router.post('/verify', ensureAdmin, function(req, res){ 
    User.updatePermissions(req.body, function(err){
      if(err) throw err;
      res.redirect('/users/verify');
      req.flash("success_msg", "User permissions updated");
    });
});



// USER REGISTRATION

router.post('/register', function(req, res, next){
  var firstname = req.body.firstname;
  var lastname = req.body.lastname;
  var email = req.body.email;
  var username = req.body.username;
  var password = req.body.userPass;
  var confirmUserPass = req.body.confirmUserPass;


  // VALIDATION
  req.checkBody('lastname', 'Last name is required').notEmpty();
  req.checkBody('firstname', 'First name is required').notEmpty();
  req.checkBody('email', 'Email is not valid').isEmail();
  req.checkBody('username', 'User name is required').notEmpty();
  req.checkBody('userPass', 'Password is required').notEmpty();
  req.checkBody('confirmUserPass', 'Password does not match').equals(req.body.userPass);

  var errors = req.validationErrors();
  
  console.log(errors);

  if (errors) {
    res.render ('register', {
      errors: errors
    });

  } else {
    
    var newUser = new User ({
      firstname: firstname,
      lastname: lastname,
      username: username,
      email: email,
      password: password,
      access: false,
      admin: false
    });

    User.createUser(newUser, function(err, user){
      if(err) throw err;
    });

    req.flash('success_msg', 'You are now registered and pending admin approval');
    res.redirect('/users/login');
  
  }

});


// USER LOGIN PROCEDURES
passport.serializeUser(function(user, done) {
  done(null, user._id);
});

passport.deserializeUser(function(id, done){
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use('login', new LocalStrategy({
    passReqToCallback : true
  },
  function(req, username, password, done) { 
    User.findOne({'username': username}, 
      function(err, user) {
        if (err)
          return done(err);
        if (!user){
          console.log('User Not Found with username '+ username);
          return done(null, false, 
                req.flash('error_msg', 'User Not found.'));                 
        }
        
        User.comparePassword(password, user.password, function(err, isMatch){
          if(err) throw err;
          if(isMatch){
            return done(null, user);
          } else {
            return done(null, false, {message: "Incorrect Password"});
          }
        });
      }
    );
}));

router.post('/login', passport.authenticate('login', { successRedirect: '../reports/index', failureRedirect: '/users/login', failureFlash: true }));

router.get('/logout', function(req, res) {
  req.logout();
  req.flash('success_msg', 'You have logged out successfully');
  res.redirect('/users/login');
});

function ensureAdmin(req, res, next){
  if(req.isAuthenticated()){
    if (req.user.admin){
      next();
    } else {
      req.flash('error_msg', "You are not permitted to see that page, talk to an administrator for access");
      res.redirect('/');
    }
  } else {
    req.flash('error_msg', 'You are not logged in.  Log in or register to continue.');
    res.redirect('/users/login');
  }
}


module.exports = router; 











