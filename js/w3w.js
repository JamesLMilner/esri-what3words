require([
"esri/map",
"esri/dijit/Geocoder",
"esri/graphic",
"esri/geometry/Point",
"esri/symbols/PictureMarkerSymbol",
"esri/InfoTemplate",
"esri/geometry/webMercatorUtils",
"dojo/dom",
"dojo/domReady!"
], function(
Map, Geocoder, Graphic, Point, PictureMarkerSymbol, InfoTemplate, webMercatorUtils, dom
) {

    var W3WKEY = '';
    var content = '';
    // create a map
    var map = new Map("map", {
        basemap: "topo",
        center: [ 0, 40 ], //Centralish view of the world
        zoom: 3, // Zoomed out far (lower is further out)
        spatialReference: 4326 //WGS84
    });

    //Instance of the Geocoder widget here, assign it to search dom element
    var geocoder =  new Geocoder({
        arcgisGeocoder: {
           placeholder: "Type an address or a what3words (word.word.word)"
        },
        autoComplete: false,
        autoNavigate: false, //override autozoom to location (this is necessary to allow for custom geocoding functionality)
        highlightLocation: false, //stop automatic location marker placement
        map: map
    }, dom.byId("search"));

    // w3w Marker
    w3wMarker = new PictureMarkerSymbol("img/marker-icon-w3w.png", 38, 44);

    // On search
    geocoder.on("find-results", showLocation);
    geocoder.on("clear", function() { $(".esriGeocoder").css("border-color", "black"); } );

    //Reverse geocode URL and unchanging parameters
    var reverseGeocodeURL = "http://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?"
    var distance = "&distance=200";
    var asJSON = "&outSR=&f=json";

    var check = ""


    function showLocation(evt) {

        console.log(evt);

        //Get the search box value
        var searchTerm = evt.target.value;

        var validTextAddress = evt.results.results.length > 0;

        // Check that there are two dots in the query and no spaces in the search term i.e. dogs.dogs.dogs or cats.cats.cats
        var w3wBool = ( ((searchTerm.split(".").length - 1)  === 2) &&
                               ((searchTerm.split(" ").length - 1) === 0) );


        // Set the resulting search object
        var searchObject = evt.results.results[0];

        // Only assign coordinates if there are actual results from the esri geocode
        if (validTextAddress) {
            console.log("Valid geocodable address");

            //webMercatorUtils allows us to convert from the Web Mercator projected coordinate system to WGS84 (a geographic coordinate system used by GPS).
            var searchGeometry = evt.results.results[0].feature.geometry;
            var coordinates = webMercatorUtils.webMercatorToGeographic(searchGeometry);
            var lng = coordinates.x;
            var lat = coordinates.y;
            var latlng = lat + "," + lng;
        }

        // Check if its a valid what 3 words format
        console.log("Search term is 3words: ", w3wBool);

        // If 3 words
         if (w3wBool) {
            console.log("what3words search term");

            var w3wParameters = {
                'key':	W3WKEY,
                'string':	searchTerm
            };


            $.post('http://api.what3words.com/w3w', w3wParameters, function(w3w) {

                //Check that it is a valid 3words there is an error in the return
                if (w3w.hasOwnProperty("error") === false) {
                    $(".esriGeocoder").css("border-color", "green");
                    console.log("Valid 3 words", w3w);

                    var w3wLng = w3w.position[1];
                    var w3wLat = w3w.position[0];

                    // Get the longitude and latitude of the 3 words, note the order!
                    var point = new Point(w3wLng, w3wLat);
                    var symbol = w3wMarker;
                    var graphic = new Graphic(point, symbol);

                    //Reverse geocode the address
                    var locationCoordinates = "location=" + w3wLng + "," + w3wLat;

                    $.get(reverseGeocodeURL + locationCoordinates + distance + asJSON, function(returnedAddress) {

                        // Clear any previous marker additions
                        map.graphics.clear();

                        console.log(returnedAddress);
                        response = $.parseJSON(returnedAddress);

                        addressText = writeAddress(response);

                        //Print address
                        console.log(addressText);


                        //Set the content of the popup
                        content = "<h3 class='info'>" + w3w.words[0] + "." + w3w.words[1] + "." + w3w.words[2] +  "</h3> <br>";

                        //Set the popup for the graphic through the maps infoWindow
                        map.infoWindow.setTitle("3 words");
                        map.infoWindow.setContent(content + addressText);

                        // We need to use the w3w coordinate points in longitude latitude format as esri geocoder ones will be incorrect!
                        w3wGeom = new Point(w3wLng, w3wLat);
                        w3wGraphic = new Graphic(w3wGeom, w3wMarker);

                        //Add the w3w marker to the page
                        map.graphics.add(w3wGraphic);

                        //Override the logic that zooms you to the address result and zoom to our 3 words.
                        map.centerAndZoom(w3wGeom, 13)

                        //Show infoWindow (the marker popup)
                        map.infoWindow.show(w3wGeom);

                        // Reset address text
                        addressText = "";

                    });
                }

                else {

                    console.log("Invalid w3w", w3w);
                    $(".esriGeocoder").css("border-color", "red");

                }
            });
         }

        // If normal address
        else {

            if (validTextAddress) {

                console.log("Address search term");
                $(".esriGeocoder").css("border-color", "green");


                w3wParameters = {
                    'key':	W3WKEY,
                    'position': latlng
                };

                $.post('http://api.what3words.com/position', w3wParameters, function(w3w) {

                    // Clear any previous marker additions
                    map.graphics.clear();
                    var point = new Point(lng, lat);
                    var symbol = new PictureMarkerSymbol("img/marker-icon-w3w.png", 32, 32);
                    var graphic = new Graphic(point, symbol);

                    // check if 2 spaces or 3 spaces and one is at the end
                    var spaces = searchTerm.split(" ").length - 1;
                    var lastchar = searchTerm.charAt(searchTerm.length - 1);
                    if ( spaces  === 2 || ( spaces  === 3 && lastchar === " ") )  {

                        console.log("two or three spaces in search terms");
                        // if at the end get rid of the end
                        if ( spaces  === 3 && lastchar === " ") {
                            console.log("removing final space");
                            searchTerm = searchTerm.slice(0, -1);
                        }

                        threeWords = searchTerm.replace(/ /g, '.').toLowerCase();
                        console.log("three words", threeWords);

                        w3wCheck = {
                            'key':	W3WKEY,
                            'string': threeWords
                        }

                        $.post('http://api.what3words.com/w3w', w3wCheck, function(check) {

                            console.log(check);

                            if (check.hasOwnProperty("error") === true) {

                               check = "If you were trying to do a what 3 words <b>" + threeWords + " </b> is not a valid 3 words";
                                console.log("invalid w3", check);
                            }

                            else {

                                check = "If you were trying to do a what 3 words try: <b>" + threeWords + "</b>";
                                console.log("valid w3 to try", check);
                            }

                            //Set the content of the popup
                            content = "<h3 class='info'>" + w3w.words[0] + "." + w3w.words[1] + "." +  w3w.words[2] +  "</h3><br><br>";

                            console.log("is check blank", check);
                            //Set the popup for the graphic through the maps infoWindow
                            map.infoWindow.setTitle("3 words");
                            map.infoWindow.setContent(content + "<b> Geocoded Address: </b> " + searchObject.name + "<br><br>" + check );

                            //Add the w3w marker to the page
                            map.graphics.add(graphic);
                            map.centerAndZoom(point, 13)

                            //Show infoWindow (the marker popup)
                            map.infoWindow.show(graphic.geometry);
                        });
                    }

                    else {
                        //Set the popup for the graphic through the maps infoWindow
                        map.infoWindow.setTitle("3 words");
                        map.infoWindow.setContent(content + "<b> Geocoded Address: </b> " + searchObject.name + "<br><br>" + check );

                        //Add the w3w marker to the page
                        map.graphics.add(graphic);
                        map.centerAndZoom(point, 13)

                        //Show infoWindow (the marker popup)
                        map.infoWindow.show(graphic.geometry);

                    }
                });
            }

            else {
                $(".esriGeocoder").css("border-color", "red");
            }

        } // End of normal address geocoding

        // Write address function
        function writeAddress(response) {
            console.log(response);
            if (response.hasOwnProperty("error") === false) {
                var addressObject = response.address;
                var addressKeys = Object.keys(addressObject);
                addressText = "<b>Geocoded Address: </b>";

                for (var i = 0; i <= addressKeys.length - 1; i++) {
                    var key = addressKeys[i];
                    if (addressObject[key] !== null && addressKeys[i] !== "Loc_name" ) {
                     addressText = addressText + addressObject[key] + ", " ;
                    }
                }

                //Remove any uncessary characters
                if (addressText.slice(-2) === ", ") { addressText = addressText.slice(0, -2); }
            }

            else { var addressText = "<b>Geocoded Address: </b> Couldn't geocode"; }

            return addressText;

        }
    }; //End of showLocation function




}); //End of JavaScript
