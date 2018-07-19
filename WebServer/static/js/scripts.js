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

	// Connect to and read our deployed GameExchange instances.
	var GameExchangeContract = web3.eth.contract(config.exchangeContract);
	var FromExchange = GameExchangeContract.at(config.fromAddress);
	var fromName = await promisify(cb => FromExchange.name(cb));
	console.log("Successfully loaded connection to exchange: " + fromName);

	// Assign functionality to the example mint button.
	// This simplified example only works because I've made my MetaMask wallet an authority.
	$("#mintButton").click(async function() {
		var mintItemId = parseInt($("#metadataInput").val());

		// Check for the existence of any such item type.
		var userId = Cookies.get('userId');
		var hasItem = false;
		var mintItemName = "";
		await $.get("/getItems?userId=" + userId, function (data) {
			for (var i = 0; i < data.length; i++) {
				var item = data[i];
				var balance = parseInt(item.balance, 10);
				var itemId = parseInt(item.item_id)
				if (itemId === mintItemId && balance > 0) {
					hasItem = true;
					mintItemName = item.item_name;
					break;
				}
			}
		});

		// Remove an instance of this item from the database if the user has one.
		if (hasItem) {
			await $.post("/removeItem", { userId: userId, itemName: mintItemName, itemId: mintItemId });
		
			// Mint the new token for this user.
			console.log("**** itemName: " + mintItemName + ", itemId: " + mintItemId);
			var gasLimit = await promisify(cb => FromExchange.mint.estimateGas(web3.eth.defaultAccount, mintItemName, { from: web3.eth.defaultAccount }, cb));
			const transactionData = {
				from: web3.eth.defaultAccount,
				gas: gasLimit,
				gasPrice: 21000000000
			};
			await promisify(cb => FromExchange.mint.sendTransaction(web3.eth.defaultAccount, mintItemName, transactionData, cb));
		}
	});

	// Assign functionality to the example logout button.
	$("#logoutButton").click(async function() {
		$.post("/logout", function(data) {
			window.location.replace("/");
		});
	});

	// Poll the exchanges every few seconds to update the dashboard.
	var updateStatus = async function () {

		// Update the display of total supply for each exchange.
		var fromTotalSupply = await promisify(cb => FromExchange.totalSupply(cb));
		var userId = Cookies.get('userId');
		await $.get("/getItems?userId=" + userId, function (data) {
			$("#totalSizeFrom").text("The exchange contains " + (data.length + fromTotalSupply) + " assets in total");

			// Update the list of this player's assets that reside solely on the game database.
			var updatedListGame = $("<ul id=\"ownedListGame\" style=\"list-style-type:circle\"></ul>");
			for (var i = 0; i < data.length; i++) {
				var item = data[i];
				var itemName = item.item_name;
				var balance = parseInt(item.balance, 10);
				var itemId = parseInt(item.item_id, 10);
				updatedListGame.append("<li>(" + itemId + ") " + itemName + " x " + balance + "</li>");
			}
			$("#ownedListGame").html(updatedListGame.html());
		});

		// Update the list of this user's ERC721 assets on the "from" exchange.
		var fromTokens = await promisify(cb => FromExchange.tokensOf(web3.eth.defaultAccount, cb));
		var updatedListFrom = $("<ul id=\"ownedListFrom\" style=\"list-style-type:circle\"></ul>");
		for (var i = 0; i < fromTokens.length; i++) {
			var tokenID = new web3.BigNumber(fromTokens[i]);
			var metadataString = await promisify(cb => FromExchange.tokenMetadata(tokenID, cb));

			// Color the entry red if it's been tokenized.
			updatedListFrom.append("<li style=\"color:red;\">" + tokenID + ": " + metadataString + "</li>");
		}
		$("#ownedListFrom").html(updatedListFrom.html());
	};
	updateStatus();
	setInterval(updateStatus, 5000);
}

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
			alert("Log into Web3!");

		// Set the default Web3 provider and account.
		} else {
			web3.eth.defaultAccount = window.web3.eth.defaultAccount;
			setup(config);
		}
	}
});