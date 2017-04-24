'use strict';

const express = require('express');
const exphbs = require('express-handlebars');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const mongoose = require('mongoose');
const validator = require('validator');

const app = express();
mongoose.connect(process.env.MONGO_URL);

const Users = require('./models/users.js');
const Tasks = require('./models/tasks.js');

// Configure our app
const store = new MongoDBStore({
  uri: process.env.MONGO_URL,
  collection: 'sessions',
});
app.engine('handlebars', exphbs({
  defaultLayout: 'main',
}));
app.set('view engine', 'handlebars');
app.use(bodyParser.urlencoded({
  extended: true,
})); // for parsing application/x-www-form-urlencoded
// Configure session middleware that will parse the cookies
// of an incoming request to see if there is a session for this cookie.
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {secure: 'auto'},
  store: store
}));

// Middleware that looks up the current user for this sesssion, if there
// is one.


function isLoggedIn(req, res, next) {
  console.log('res.locals.currentUser = ' , res.locals.currentUser);
	if(res.locals.currentUser) {
		next();
	}
	else {
		res.sendStatus(403);
	}
}


/*function loadUserTasks(req, res, next){
  if(!res.locals.currentUser){
    return next();
  }

  Tasks.find({owner: res.locals.currentUser}, function(err, tasks){
    if(!err){
      res.locals.tasks = tasks;
    }
    next();
  })
}*/


function loadUserTasks(req, res, next){
  if(!res.locals.currentUser){
    return next();
  }

  Tasks.find({})
    .or({owner: res.locals.currentUser})
    .or({collaborator: res.locals.currentUser.email})
    .exec(function(err, tasks){
      if(!err){
        res.locals.tasks = tasks;
      }
      next();
    })
  }



app.use(function(req,res, next){
  console.log('req.session =', req.session);
  if(req.session.userId){
    Users.findOne(req.session.userId, function(err, user){
      if(!err){
        res.locals.currentUser = user;
      }
      next();
    })
  } else {
     next();
  }
})
// Middleware that checks if a user is logged in. If so, the
// request continues to be processed, otherwise a 403 is returned.



// Middleware that loads a users tasks if they are logged in.
/*function loadUserTasks(req, res, next) {
  // Removed
  next();
}*/



// Return the home page after loading tasks for users, or not.
app.get('/' , loadUserTasks, function (req, res)  {
  Users.count(function(err, users) {
    if(err) {
      res.send('error getting users');
    } else {
        res.render('index', {
          userCount: users.length,
          currentUser: res.locals.currentUser
      });
    }
  });
});


// Handle submitted form for new users
app.post('/user/register', (req, res) => {
  if(req.body.password !== req.body.passwordConfirmation) {
    return res.render('index', {errors: "Password and password confirmation do not match"});
  }
  var newUser = new Users();
  newUser.hashed_password = req.body.password;
  newUser.email = req.body.email;
  newUser.name = req.body.name;
  newUser.save(function(err, user){

    if(req.body.password.length < 1 || req.body.password.length > 50) {
      err = 'Bad password';
      res.render('index', {errors: err});
      return;
    }
    else if(req.body.name.length < 1 || req.body.name.length > 50) {
      err = 'Name must be between 1 and 50 character.';
      res.render('index', {errors: err});
      return;
    }


    if(err){
      err = "Error registering you";
      res.render('index', {errors: err});
    } else {
      req.session.userId = user._id;
      res.redirect('/');
    }
  })
  console.log('The user has the email address', req.body.email);
});


app.post('/user/login', function (req, res) {
	var user = Users.findOne({email: req.body.email}, function(err, user) {
		if(err || !user) {
			res.render('index', {errors: "Invalid email address"});
			return;
		}



		user.comparePassword(req.body.password, function(err, isMatch) {
			if(err || !isMatch){
				res.render('index', {errors: 'Invalid password'});
				console.log('\n\nInvalid password.\n\n');
				// res.render('index', {errors: 'Invalid password'});
				return;
	   		}
		   	else{
				req.session.userId = user._id;
				res.redirect('/');
				return;
		   	}

		});
	});
});


app.use(isLoggedIn);

app.post('/task/create', function (req, res) {
	var newTasks = new Tasks();
	newTasks.owner = res.locals.currentUser._id;
	newTasks.title = req.body.title;
	newTasks.description = req.body.description;
	newTasks.collaborators = [req.body.collaborator1, req.body.collaborator2, req.body.collaborator3];
	//newTask.isComplete = false;
	newTasks.save(function(err, savedTasks){
		if(err || !savedTasks){
      res.render('index', {errors: "Error saving to database"});
			return;
		}
		else {
			// console.log('New task added: ', task.title);
			res.redirect('/');
		}
	});
});



/*
app.get('/task/complete', function(req, res) {

	console.log('Completing task. Id: ', req.query.id);

	task.findById(req.query.id, function(err, completedTask) {
		if(err || !completedTask) {
			console.log('Error finding task on database.');
			res.redirect('/');
		}
		else {
			console.log("Method called.");
			completedTask.completeTask();
			res.redirect('/');
		}
	});
});



app.get('/task/remove', function(req, res) {
	console.log('Removing task. Id: ', req.query.id);

	task.findById(req.query.id, function(err, taskToRemove) {
		if(err || !taskToRemove) {
			console.log('Error finding task on database.');
			res.redirect('/');
		}
		else {
			taskToRemove.remove();
			res.redirect('/');
		}
	});
});
*/

app.get('/user/logout', function(req, res){
  req.session.destroy(function(){
    res.redirect('/');
  });
});


/*
//  All the controllers and routes below this require
//  the user to be logged in.
app.use(isLoggedIn);

// Handle submission of new task form
app.post('/tasks/:id/:action(complete|incomplete)', (req, res) => {
  res.send('woot');
});

app.post('/tasks/:id/delete', (req, res) => {
  res.send('woot');
});

// Handle submission of new task form
app.post('/task/create', (req, res) => {
  res.send('woot');
});
*/
// Start the server
app.listen(process.env.PORT, () => {
  console.log(`Example app listening on port ${process.env.PORT}`);
});
