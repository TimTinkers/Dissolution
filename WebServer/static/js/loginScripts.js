// A helper which can seamlessly convert contract calls to Promises. Thanks to:
// https://ethereum.stackexchange.com/questions/11444/web3-js-with-promisified-api/24238#24238
// http://shawntabrizi.com/crypto/making-web3-js-work-asynchronously-javascript-promises-await/
const promisify = (inner) =>
new Promise((resolve, reject) =>
	inner((err, res) => {
		if (err) {
			reject(err);
		} else {
			resolve(res);
		}
	})
);

// A function which asynchronously sets up the page.
var setup = async function (config) {

	// Assign functionality to the example show signup button.
	$("#showSignup").click(async function() {
		$("#loginBox").hide();
		$("#signupBox").show();
		update();
	});

	// Assign functionality to the example show login button.
	$("#showLogin").click(async function() {
		$("#signupBox").hide();
		$("#loginBox").show();
		update();
	});

	// Poll the user's active wallet address ever few seconds.
	var update = async function () {

		// Update the box displaying this address to the user.
		web3.eth.defaultAccount = window.web3.eth.defaultAccount;
		$("#walletAddressDisplay").html(web3.eth.defaultAccount);
		$("#walletAddressInput").val(web3.eth.defaultAccount);
		$("#walletAddressInputSignup").val(web3.eth.defaultAccount);
	};
	update();
	setInterval(update, 2500);
}

// Once the window has fully loaded, begin page setup.
window.addEventListener("load", function () {

	// Parse the configuration file and pass to setup.
	$.getJSON("js/config.json", function (config) {

		// The demo cannot proceed if Web3 is not present.
		if (typeof window.web3 === "undefined") {
			console.error("Web3 is required.");
			alert("Web3 is required. Try downloading MetaMask?");

		// The demo cannot proceed if Web3 is not logged into.
		} else {
			var web3 = new Web3(window.web3.currentProvider);
			console.log(window.web3.eth.defaultAccount);
			if (typeof window.web3.eth.defaultAccount === "undefined") {
				console.error("Must log into your Web3 client.");
				alert("Log into MetaMask or your Web3 provider!");

			// Set the default Web3 provider and account.
			} else {
				web3.eth.defaultAccount = window.web3.eth.defaultAccount;
				setup(config);
			}
		}
	});
});