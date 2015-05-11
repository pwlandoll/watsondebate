
// Module dependencies
var express = require('express')
  , http = require('http')
  , path = require('path')
  , bodyParser = require('body-parser')
  , request = require('request');

var app = express();

// Set the server port
app.set('port', process.env.PORT || 3001);

app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));
var Client = require('node-rest-client').Client;

app.use(bodyParser.json());

// Development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

// Expose static web page resources
app.use("/", express.static(__dirname + '/public'));


// Set up RESTful resources
// POST requests to /question are handled by ‘watson.question’
app.post('/question', question);
app.get('/download', download);

var options_auth = {
  user: "jcu_student1",
  password: "ORxea1ly"
};

var weaClient = new Client(options_auth);

var CONVERSATION_ID;
var baseWEAUrl = "https://watson-wdc01.ihost.com/instance/523/predeploy/$14c2d19bcf8/watson/wea/v2";

function question(req, res, next) {
  var message = req.body.message;
  console.log("Recieved message: " + message);

  // no conversation exists, create a new one
  if (!CONVERSATION_ID) {
    var args = {
      data: {},
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "user_token": "sample_user_token"
      }
    };

    var req = weaClient.post(baseWEAUrl + "/conversation", args,
            processNewConvo);

    function processNewConvo(data, response) {
      if (data.conversation_id) {
        CONVERSATION_ID = data.conversation_id;
        console.log('added conversation id ' + CONVERSATION_ID);
        postMessageToWEA();
      }
    }

    req.on('error', function(err) {
      console.log('request error', err);
    });
  } else {
    postMessageToWEA()
  }

  function postMessageToWEA() {
    var args = {
      data: {
        message: message
      },
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      }
    };

    var req = weaClient.post(baseWEAUrl + "/conversation/" + CONVERSATION_ID,
            args, processMessage);

    function processMessage(data, response) {
      res.json(data);
    }

    req.on('error', function(err) {
      console.log('request error', err);
    });
  }
}

function download(req, res) 
{
	
	if (req.query.uri===undefined)
	{
		res.status(404).send('Not Found');	
		return;
	}
	// In order to get the document, we will first get the document file name from the URI
	var documentFileName;
	request.get("https://" + options_auth.user + ":" + options_auth.password + "@watson-wdc01.ihost.com:443/instance/523/predeploy/$14c2d19bcf8/watson/wea/v2/document/"+ req.query.uri.substring(10) +  "?metadata=true&text=false&format=false&before=0&after=0", function(error, response, body)
	{
		if (body != "" && JSON.parse(body).metadata!==undefined)
		{
			documentFileName = JSON.parse(body).metadata[0].values[0];
			if (documentFileName!==undefined)
			{
				// After we have the document file name, we attempt to find the document's id.
				console.log("Download request for file: \"" + documentFileName + "\"");
				request.get("https://" + options_auth.user + ":" + options_auth.password + "@watson-wdc01.ihost.com:443/instance/523/predeploy/$14c2d19bcf8/xmgr/corpus/document?filter=" + documentFileName, function(error, response, body)
				{
					// YAY nested callbacks :)
					body = JSON.parse(body);
					var id = -1;
					if (body!==undefined)
					{
						for (i = 0; i < body.length;i++)
						{
							if (body[i].url.indexOf("/"+documentFileName)>-1)
							{
								id = body[i].id;
								break;
							}
						}
					}
					else
					{
						res.status(404).send('Not Found');	
					}
					
					if (id!=-1)
					{
						// Once we have the document's id, we pipe it back to the user.
						newReq = request.get("https://" + options_auth.user + ":" + options_auth.password + "@watson-wdc01.ihost.com:443/instance/523/predeploy/$14c2d19bcf8/xmgr/corpus/document/download/" + id + "?disposition=attachment")
						
						newReq.pipe(res);
						console.log("Download complete for file: \"" + documentFileName + "\"");
					}
					else
					{
						res.status(404).send('Not Found');	
					}
				});
			}
			else
			{
				res.status(404).send('Not Found');			
			}
		}
		else
		{
			res.status(404).send('Not Found');
		}
	});   
	
}

// Start the http server
http.createServer(app).listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});
