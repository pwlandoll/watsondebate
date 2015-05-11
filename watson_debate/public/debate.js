var WatsonFilms = WatsonFilms || {};

WatsonFilms.App = function() {
    // The current Slick Carousel index
    var slickIndex = 0;
    
    // Initialize sample questions dropdown button
    var initSampleQuestions = function() {
        var searchForm = $("#searchForm");
        var samples = $('#sampleQuestions ul');
        
        
        $('.sampleQuestion').click(function(e) {
            // On click, get the selected question text and submit the form 
            $('#searchTerm').val($(this).text());
            searchForm.submit();
            e.preventDefault();
        });
        
    };

    // Create a modal dialog to host an answer's evidence
    var createEvidenceModal = function(i, r) {
        var evidenceModal = $('#evidence').clone();
        if (r.responses[i].title === undefined) {
            return evidenceModal;
        }
        evidenceModal.attr('id', 'evidence-' + i);
        evidenceModal.find('#text').text("Evidence text");
        evidenceModal.find('#title').text(r.responses[i].title);
        evidenceModal.find('#copyright').text("Copyright Text/Another Atribute, etc. here");
        evidenceModal.insertAfter('#evidence');
        return evidenceModal;
    };
    
    // Create a 'Slick Carousel' slide that hosts an answer
    // and its confidence
    var createAnswerSlide = function(i, r) {
        var answer = r.responses[i];
        var answerContainerDiv, answerDiv, confidenceDiv, evidenceRef;

        answerContainerDiv = $("<div>");
        answerDiv = $("<div>", {
            id : 'answer' + i,
            'html' : answer.text,
            'class' : 'answerContent'
        });

        answerContainerDiv = $("<div>", {
            id : 'panswer' + i
        });
        answerDiv.appendTo(answerContainerDiv);

        createEvidenceModal(i, r);

        evidenceRef = $('<a>', {
            'href' : '#',
            'id' : 'evidence' + i,
            'text' : (answer.confidence * 100).toFixed(2) + "%",
            'class' : 'clink' + i,
            'onclick' : "$('#evidence-" + i + "').modal('show'); return false;"
        });

        confidenceDiv = $("<div>", {
            'class' : 'confidence',
            'text' : 'Confidence: '
        });
        
        evidenceRef.appendTo(confidenceDiv);
        
        if (answer.document_uri!==undefined)
		{
    		sourceDownload = $("<a>", 
    		{
                'class' : 'confidence',
                'text' : 'Download source',
    			'href' : "/download/?uri=" + answer.document_uri
            });
            
            googleDoc = $("<a>", 
    		{
                'class' : 'confidence',
                'text' : 'Open In Google Docs',
    			'href' : "https://docs.google.com/gview?url=http://debate.mybluemix.net/download/?uri=" + answer.document_uri,
    			'target' : '_blank'
            });
            
    		
    		sourceDownload.appendTo(confidenceDiv);
    		googleDoc.appendTo(confidenceDiv);
		}

        

        confidenceDiv.appendTo(answerContainerDiv);
        return answerContainerDiv;
    };
    
    // Display the answers return in the response, r, in
    // 'Slick Carousel' slides.
    var displayAnswers = function(r) {
        var answerCarousel = $("#answerCarousel");
        var answerText = "Hmm. I'm not sure.";
        slickIndex = 0;

        if (r.responses[0] !== undefined) {
            answerText = r.responses[0].text;
            console.log('answer: ' + answerText);
            slickIndex = r.responses.length;
        }

        answerCarousel.show();

        // Add slides containing answers to the 'Slick Carousel' 
        for (var i = 0; i < slickIndex; i++) {
            $('#panswer' + i).remove();
            answerCarousel.slickAdd(createAnswerSlide(i, r));
        }

        // Set to the first answer slide
        answerCarousel.slickGoTo(0);
    };

    // Clear and hide the 'Slick Carousel' answer slides
    var clearAnswers = function() {
        var answerCarousel = $('#answerCarousel');
        for (var i = slickIndex - 1; i >= 0; i--) {
            answerCarousel.slickRemove(i);
        }
        slickIndex = 0;
        answerCarousel.hide();
    };
    
    // Ask a question.
    // Invoke the Node.js REST service. The Node.js
    // service, in turn, invokes the IBM Watson QAAPI
    // and returns to us the QAAPI response
    var ask = function(question) {     
        
		var searchTerm = $("#searchTerm");
        var samples = $('.dropDownSampleQuestion');
        // Create a Ladda reference object 
        var l = Ladda.create(document.querySelector('button'));
        
        // Clear answers,disable search, and start the progress indicator
        clearAnswers();
        searchTerm.attr("disabled", "disabled");
        samples.attr("disabled", "disabled");
        l.start();
        
        // Form a question request to send to the Node.js REST service
        var questionEntity = {
            'message' : question
        };
		
		// Grab keywords (comma separated) that user has specified for filtering responses
		var keywords = [];
		if ($("#keywordTxtBx").val().indexOf(",") != -1) {
			keywords = $("#keywordTxtBx").val().split(",");
		}
		else {
			keywords.push($("#keywordTxtBx").val());
		}

        // POST the question request to the Node.js REST service
        $.ajax({
            type : 'POST',
            data : questionEntity,
            dataType : "json",
            url : '/question',
            success : function(r, msg) {
                // Enable search and stop the progress indicator
                searchTerm.removeAttr("disabled");
                samples.removeAttr("disabled");
                l.stop();
				
				// Filter responses
				var filteredResponses = filterByKeywords(keywords, r);
                
                // Display answers or error
                if (filteredResponses.responses[0] !== undefined) {
                    displayAnswers(filteredResponses);
                } else {
                    alert("Error communicating with Watson.");
                }
            },
            error : function(r, msg, e) {
                // Enable search and stop progress indicator
                searchTerm.removeAttr("disabled");
                samples.removeAttr("disabled");
                l.stop();
                
                // Display error
                if (r.responseText) {
                	alert(e+' '+r.responseText);	
                } else {
                	alert(e);
                }
                
            }
        });
    };
	
	// Filters response from Watson down to only relevant documents
	// based on provided keywords
	var filterByKeywords = function (keywords, r) {
		// Used to filter out Watson's default response
		var defaultResponse = '<h1 class="topicTitle"></h1> <div>I\'m sorry, I don\'t have advice for you about that</div>';
		var filteredResponses = {};
		var responses = [];
		filteredResponses["message_id"] = r.message_id;
		filteredResponses["message"] = r.message;
		// For each of Watson's response documents
		$.each(r.responses, function (key, document) {
			// For each provided keyword
			$.each(keywords, function (k, keyword) {
				// If the keyword is contained in the document
				if (document.text.toLowerCase().indexOf(keyword.toLowerCase()) >= 0) {
					// If the document is not already contained within the to-be returned array
					// and if the document is not a default response (see above)
					if (responses.indexOf(document) === -1 && document.text !== defaultResponse) {
						responses.push(document);
					}
				}
			})
		});
		filteredResponses["responses"] = responses;
		return filteredResponses;
	};

    // Initialize the application
    var init = function() {
        var searchForm = $("#searchForm");
        var searchTerm = $("#searchTerm");

        searchTerm.focus();
        
        clearAnswers();

        // Wire the search for to ask a question
        // on submit
        searchForm.submit(function(e) {
		
		var selectionBox = document.getElementById("selectIssues");

        //If "All Topics" is selected, then make issues to be all the issues
        var issues = selectionBox.options[selectionBox.selectedIndex].value;
        
        var topic = document.getElementById("topicTxtBox").value;
        var question = "";
        if (issues == "All Issues") {
            question = topic;
        } else {
            question = "What are the " + issues +  " to " + topic + "?";
        }
		console.log("Asking Watson: " + question);
        ask(question);
        });

        // Wire the search input box to submit
        // on <enter>
        searchTerm.on('keyup', function(e) {
            if (e.which === 13) {
                searchForm.submit();
            }
        });

        // Initialize the 'Slick Carousel'
        $('.single-item').slick({
            dots : true,
            infinite : true,
            speed : 300,
            slidesToShow : 1,
            slidesToScroll : 1
        });
		
	//displayAnswers(responses);
    };

    // Expose privileged methods
    return {
        init : init
    };
	
}();
