//emailing reports
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

// need these file for answerlist and mailer database table
var MailReport = require('../models/mailer.js');
var AnswerList = require('../models/answerList.js');
var template = fs.readFileSync("./views/email_layouts/email.hjs", "utf-8");
var compiledTemplate = hogan.compile(template);
var ansKey = JSON.parse(fs.readFileSync("./answerKey.json"));

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

var mailOptions = {
  from: 'New England Public Health Training Center <noreply@nephtc.org>',
  to: '',
  subject: 'Your Inspection Test Results',
  html: ''
};

router.get('/', function(req, res) {
  res.sendStatus(404);
});

router.post('/', function(req, res) {

  // create db object
  var report = new MailReport();
  report.formData = sanitize(req.body.json);

  // get email
  var mailData = JSON.parse(report.formData);
  var email = mailData.emailAddress;
  // var name = mailData.name; // *** Use name when available ***
  
  // insert into db 
  report.save(function(err, data) {
    if (err) {
      console.log(err);
      res.sendStatus(503);
    } else {

      var host = req.headers.host;
      var usrUrl = "https://" + host + "/mailer/" + data._id;

      // On callback configure email
      mailOptions.to = email;
      mailOptions.html = compiledTemplate.render({email: email, usrUrl: usrUrl}); // mail template located in views/hogan_email_template/email.hjs
      //mailOptions.html = compiledTemplate.render({email: email, usrUrl: usrUrl, name: name}); // *** Use name when available ***

      // Send
      transporter.sendMail(mailOptions, function(err, res){
        if (err) {
          res.sendStatus(501);
          console.log(err);
        } else {
          console.log(res);
        }      
      });
      res.sendStatus(200);
    }

  });
});

/**** GET:[PARAMS_ID] ****/
router.get('/:mail_report_id', function(req, res) {
  MailReport.findById(req.params.mail_report_id, function(err, report) {
      if (err) {
        res.sendStatus(404);
        console.log(err);
      }
      var mailReport = JSON.parse(report.formData);
      var list = new AnswerList();
      var answers = list.getAnswers(ansKey.inspReportJsonList, mailReport.inspReportJsonList);
      var email = mailReport.emailAddress;
      // var name = report.name; // *** Use name when avaialble ***

      // Render report show page 
      res.render('../views/mailReportShow', {title: "Final Report", answers: answers, email: email});
      // res.render('../views/show', {answers: answers, email: email, name: name}); // *** Use name when available ***
  });
});

router.put('/:mail_report_id', function(req, res) {
  res.sendStatus(405);
});

router.patch('/:mail_report_id', function(req, res) {
  res.sendStatus(405);
});

router.delete('/:mail_report_id', function(req, res){
  res.sendStatus(405);
});

module.exports = router;