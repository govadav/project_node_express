//support page
var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var sanitize = require('mongo-sanitize');
var sendgrid = require('sendgrid');
var handlebars = require('express-handlebars');
var hogan = require('hogan.js');
var fs = require('fs');
var helpers = require('handlebars-helpers')();
var url = require('url');
var mongoose = require('mongoose');
var nodemailer = require('nodemailer');
var template = fs.readFileSync("./views/email_layouts/supportEmail.hjs", "utf-8");
var compiledTemplate = hogan.compile(template);
var User = require("../models/user");
//requires user.js file in models to verify user submitting request
var transporter = nodemailer.createTransport({
  host: 'smtp.nephtc.org',
  port: 25,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  },
  tls:  {
    rejectUnauthorized: false
  }
});

router.get('/', isLoggedIn, function(req, res){
  res.render('support');
});

router.get('/submitted', isLoggedIn, function(req, res){
  res.render('submitted');
});

router.post('/', isLoggedIn, function(req, res){
  var user = req.user;
  var userid = user.id;
  var username = user.username;
  var fullname = user.firstname + " " + user.lastname;
  var userEmail = user.email;
  var ticketSubject = req.body.subject;
  var ticketBody = req.body.body;
  var submitted = Date.now();

  // VALIDATION
  req.checkBody('subject', 'You must include a subject line').notEmpty();
  req.checkBody('body', 'Please describe the issue in the box').notEmpty();

  var errors = req.validationErrors();

  if (errors) {
    res.render ('support', {
      errors: errors
    });

  } else {

    var mailOptions = {
      from: 'New England Public Health Training Center <noreply@nephtc.org>',
      to: 'jsquire4@bu.edu',
      subject: 'NEPHTC Reports - Support Request: ' + ticketSubject,
      html: compiledTemplate.render({userEmail: userEmail, fullname: fullname, ticketSubject: ticketSubject, ticketBody: ticketBody})
    };

    transporter.sendMail(mailOptions, function(err, res){
        if (err) {
          res.sendStatus(501);
          console.log(err);
        } else {
          console.log(res);
        }      
      });

      req.flash('success_msg', 'Support Ticket Submitted');
      res.redirect('/support/submitted');
    }
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

function isLoggedIn(req, res, next){
  if(req.isAuthenticated()){
    next();
  } else {
    req.flash('error_msg', 'You are not logged in.  Log in or register to continue.');
    res.redirect('/users/login');
  }
}

module.exports = router; 