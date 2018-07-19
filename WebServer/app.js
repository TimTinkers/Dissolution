// Imports and application setup.
var express = require('express');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var mysql = require('mysql');
var app = express();
app.use(express.static('static'));
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(cookieParser());

// Middleware for enabling async routes with Express.
const asyncMiddleware = fn => (req, res, next) => {
	Promise.resolve(fn(req, res, next))
	.catch(next);
};

// Setup connection to database.
var connection = mysql.createConnection({
	host    : "dissolution-accounts.ccpwdkoashqq.us-east-1.rds.amazonaws.com",
	user    : "dissolution_root",
	password: "dissolution_master",
	port    : "3306",
	database: "user_accounts",
	timeout: 30000
});

// Establish and verify connection to database.
connection.connect(function (err) {
	if (err) {
		console.error("Database connection failed: " + err.stack);
		return;
	}
	console.log("Connected to database.");
});

// Redirect visitors to the dashboard.
app.get("/", function (req, res) {
	if (req.cookies.login === 'true') {
		res.render("dashboard");	
	} else {
		res.render("login");
	}
});

// Check whether a given username and password pair is valid.
// Returns the user's ID if valid, -1 otherwise.
function checkLogin(username, password) {
	var sql = "SELECT `user_id` FROM `user_accounts`.`login_data` WHERE (`username`=? OR `email`=?) AND (`password`=?);";
	var values = [ username, username, password ];

	// Execute the query as a promise.
	return new Promise((resolve, reject) => {
		connection.query(sql, values, function (err, result) {
			if (err) {
				console.error("Bad query: " + this.sql)
				console.error("Check login query failed: " + err.stack);
				return reject(err);
			} else if (result.length === 1) {
				resolve(result[0].user_id);
			} else {
				resolve(-1);
			}
		});
	});
};

// Handle visitors signing in.
app.post("/signup", asyncMiddleware(async (req, res, next) => {

	// Retrieve posted account information.
	var username = req.body.username;
	var email = req.body.email;
	var password = req.body.password;
	var passwordConfirm = req.body.passwordConfirm;
	var wallet = req.body.wallet;
	console.log("Signing up: " + username + " - " + email + " - " + password + " - " + passwordConfirm + " - " + wallet);

	// Execute the query.
	var sql = "INSERT INTO `user_accounts`.`login_data` (`username`, `email`, `password`, `wallet`) VALUES ?";
	var values = [ [username, email, password, wallet] ];
	connection.query(sql, [ values ], async function (err, result) {
		if (err) {
			console.error("Bad query: " + this.sql)
			console.error("Signup query failed: " + err.stack);
			return;
		} else {
			console.log("Inserted account rows: " + result.affectedRows);
			res.cookie("login", true, { maxAge: 900000, httpOnly: false });
			var userId = await checkLogin(username, password);
			res.cookie("userId", userId, { maxAge: 900000, httpOnly: false });
			res.redirect("/");
		}
	});
}));

// Handle visitors logging in through the web app.
app.post("/login", asyncMiddleware(async (req, res, next) => {
	var username = req.body.username;
	var password = req.body.password;
	var wallet = req.body.wallet;
	var userId = await checkLogin(username, password);
	console.log("*** userId: " + userId);
	var loginStatus = (userId !== -1);
	console.log("Checking login: " + username + " - " + password + " - " + wallet + ": (" + userId + ", " + loginStatus + ").");
	res.cookie("login", loginStatus, { maxAge: 900000, httpOnly: false });
	res.cookie("userId", userId, { maxAge: 900000, httpOnly: false });
	res.redirect("/");
}));

// Retrieve a login status without setting cookie or redirecting; for API use.
app.post("/checkLogin", asyncMiddleware(async (req, res, next) => {
	var username = req.body.username;
	var password = req.body.password;
	var userId = await checkLogin(username, password);
	var loginStatus = (userId !== -1);
	console.log("Checking login: " + username + " - " + password + ": (" + userId + ", " + loginStatus + ").");
	res.send({ status: loginStatus, userId: userId });
}));

// Handle visitors logging out.
app.post("/logout", function (req, res) {
	console.log("Logging out.");
	res.clearCookie("login");
	res.redirect("/");
});

// Add a "fungible" instance of an item type to a player's inventory.
app.post("/addItem", function (req, res) {

	// Retrieve posted account information.
	var userId = req.body.userId;
	var itemId = req.body.itemId;
	var itemName = req.body.itemName;
	console.log("Adding 1 " + itemName + " (" + itemId + ") to inventory of ID " + userId);

	// Execute the query.
	var sql = "INSERT IGNORE INTO `user_accounts`.`fungible_inventory_data` (`user_id`, `item_id`, `item_name`, `balance`) VALUES ? ON DUPLICATE KEY UPDATE `balance`=`balance`+1";
	var values = [ [userId, itemId, itemName, 1] ];
	connection.query(sql, [ values ], function (err, result) {
		if (err) {
			console.error("Bad query: " + this.sql)
			console.error("Add item query failed: " + err.stack);
			return;
		} else {
			console.log("Added item successfully.");
			res.send("ok");
		}
	});
});

// Remove a "fungible" instance of an item type from a player's inventory.
app.post("/removeItem", function (req, res) {

	// Retrieve posted account information.
	var userId = req.body.userId;
	var itemId = req.body.itemId;
	var itemName = req.body.itemName;
	console.log("Removing 1 " + itemName + " (" + itemId + ") from inventory of ID " + userId);

	// Execute the query.
	var sql = "INSERT IGNORE INTO `user_accounts`.`fungible_inventory_data` (`user_id`, `item_id`, `item_name`, `balance`) VALUES ? ON DUPLICATE KEY UPDATE `balance`=`balance`-1";
	var values = [ [userId, itemId, itemName, 0] ];
	connection.query(sql, [ values ], function (err, result) {
		if (err) {
			console.error("Bad query: " + this.sql)
			console.error("Add item query failed: " + err.stack);
			return;
		} else {
			console.log("Removed item successfully.");
			res.send("ok");
		}
	});
});

// Retrieve all "fungible" items in a user's inventory.
app.get("/getItems", function (req, res) {

	// Retrieve posted account information.
	var userId = req.query.userId;
	console.log("Retrieving inventory of ID " + userId);

	// Execute the query.
	var sql = "SELECT `item_id`, `item_name`, `balance` FROM `user_accounts`.`fungible_inventory_data` WHERE `user_id`=?;";
	var values = [ userId ];
	connection.query(sql, values, function (err, result) {
		if (err) {
			console.error("Bad query: " + this.sql)
			console.error("Get inventory query failed: " + err.stack);
			return;
		} else {
			console.log("Retrieved inventory successfully.");
			res.send(result);
		}
	});
});

// Launch the application and begin the server listening.
app.listen(3000, function () {
	console.log("Game exchange server listening on port 3000.");
});
