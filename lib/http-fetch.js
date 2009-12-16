const curl = require( "curl" ),
      binary = require( "binary" );

function parseArgs( args ) {
  args = Array.slice( args );

  // url is first and mandatory
  var url = args.shift(),
      type = "GET",
      data = {},
      options = {},
      callback;

  // TODO should type be in options?
  if ( typeof args[ 0 ] === "string" ) type = args.shift();
  if ( typeof args[ 0 ] === "object" ) data = args.shift();
  if ( typeof args[ 0 ] === "object" ) options = args.shift();
  if ( typeof args[ 0 ] === "function" ) callback = args.shift();

  // some cleanup
  if ( typeof options.headers === "undefined" ) options.headers = {};

  return [ url, type, data, options, callback ];
}

function empty( obj ) {
  var key;

  for ( key in obj ) {};

  return typeof key === "undefined";
}

function encodeData( hash ) {
  var data = "";

  for ( var k in hash ) {
    data += "&" + encodeURIComponent( k )
          + "=" + encodeURIComponent( hash[ k ] );
  }

  // strip the leading &
  data = data.substring( 1 );

  return data;
}

/**
 * http-fetch.fetch(url[, callback]) -> io.bytestring
 * http-fetch.fetch(url, data[, callback]) -> io.bytestring
 * http-fetch.fetch(url, data, options[, callback]) -> io.bytestring
 * - url (String): URL to request
 * - type (String): Request type, defaults to GET
 * - data (Object): Key/value pairs to include with the request
 * - options (Object): Configuration options for cURL behaviour
 * - callback (Function): Function to call with the results of the request.
 *   If no callback is provided the request will be blocking and the result
 *   will be returned. The callback can actually be given anywhere in the
 *   argument list, not just in the final position.
 *
 * Makes an HTTP GET or POST request.
 */
exports.fetch = function() {
  var [ url, type, data, options, callback ] = parseArgs( arguments ),
      c = new curl.Easy(),
      response = new binary.ByteString();

  if ( type === "GET" && !empty( data ) ) {
    // append the data to the URL for a GET
    url += "?" + encodeData( data );
  }
  else if ( type === "POST" ) {
    c.options.postfields = encodeData( data );
  }

  c.options.url = url;

  // headers!
  var headers = [];
  for ( var h in options.headers ) {
    headers.push( h + ": " + options.headers[ h ] );
  }
  c.options.httpheader = headers;

  // concatenate the bytestring for later.
  c.options.writefunction = function( data ) {
    response = response.concat( data );
    return data.length;
  }

  c.perform();

  // if a transformer was passed in, run the response through it
  if ( typeof options.transformer === "function" ) {
    response = options.transformer( response );
  }

  // do a callback if provided, otherwise just return
  // TODO make the callback option non-blocking
  if ( typeof callback === "function" ) {
    callback( response );
    return undefined;
  }
  else {
    return response;
  }
}

/**
 *
 */
exports.fetchText = function() {
  var [ url, type, data, options, callback ] = parseArgs( arguments );

  // add a transformer to decode the bytestring to text
  // TODO make it handle different character encodings
  options.transformer = function( x ) x.decodeToString();

  return this.fetch( url, type, data, options, callback );
}

/**
 *
 */
exports.fetchJSON = function() {
  var [ url, type, data, options, callback ] = parseArgs( arguments );

  // add a transformer to return JSON
  // TODO use a less crappy JSON parser (and handle charset)
  options.transformer = function( x ) JSON.parse( x.decodeToString() );

  // add an accept header for JSON
  options.headers.accept = options.headers.accept || "application/json;q=0.9,*/*;q=0.1";

  return this.fetch( url, type, data, options, callback );
}

/**
 *
 */
exports.fetchXML = function() {
  var [ url, type, data, options, callback ] = parseArgs( arguments );

  // add a transformer to return a DOM
  options.transformer = function( response ) {
    var stream = require( "io" ).BinaryStream( response );
    return require( "xml" ).XMLParser.parse( stream );
  }

  // add an accept header for XML
  options.headers.accept = options.headers.accept || "application/xml;q=0.9,*/*;q=0.1";

  return this.fetch( url, type, data, options, callback );
}

exports.fetchHTML = function() {
  var [ url, type, data, options, callback ] = parseArgs( arguments );

  // add a transformer to return a DOM
  options.transformer = function( response ) {
    var stream = require( "io" ).BinaryStream( response ),
        doc = require( "xml" ).HTMLParser.parse( stream ),
        sizzle = require( "sizzle" ).Sizzle( doc );

    // make the raw document available
    sizzle.document = doc;

    return sizzle;
  }

  // add an accept header for HTML
  options.headers.accept = options.headers.accept || "text/html;q=0.9";

  return this.fetch( url, type, data, options, callback );
}
