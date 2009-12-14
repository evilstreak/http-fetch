const curl = require( "curl" ),
      binary = require( "binary" );

var futzArguments = function( args ) {
  var a, fixed = {
    url : undefined,
    data : undefined,
    options : undefined,
    callback : undefined
  };

  args = Array.slice( args );

  while ( ( a = args.shift() ) ) {
    switch ( typeof a ) {
      case "string" :
        if ( fixed.url === undefined ) fixed.url = a;
        break;
      case "function" :
        if ( fixed.callback === undefined ) fixed.callback = a;
        break;
      case "object" :
        if ( fixed.data === undefined ) fixed.data = a;
        else if ( fixed.options === undefined ) fixed.data = a;
        break;
    }
  }

  // use empty data if not set
  if ( fixed.data === undefined ) {
    fixed.data = {};
  }

  // use empty options if not set
  if ( fixed.options === undefined ) {
    fixed.options = {};
  }

  if ( fixed.options.headers === undefined ) {
    fixed.options.headers = {};
  }

  return fixed;
}

/**
 * http-fetch.get(url[, callback]) -> io.bytestring
 * http-fetch.get(url, data[, callback]) -> io.bytestring
 * http-fetch.get(url, data, options[, callback]) -> io.bytestring
 * - url (String): URL to request
 * - data (Object): Key/value pairs to include with the request
 * - options (Object): Configuration options for cURL behaviour
 * - callback (Function): Function to call with the results of the request.
 *   If no callback is provided the request will be blocking and the result
 *   will be returned. The callback can actually be given anywhere in the
 *   argument list, not just in the final position.
 *
 * Makes an HTTP GET request.
 */
exports.get = function( args ) {
  if ( arguments.length > 1 || typeof args === "string" ) {
    args = futzArguments( arguments );
  }

  if ( args.url === undefined ) {
    throw "No URL provided";
  }

  var c = new curl.Easy(),
      response = new binary.ByteString();

  c.options.url = args.url;
  c.options.writefunction = function( data ) {
    response = response.concat( data );
    return data.length;
  }

  // headers!
  var headers = [];
  for ( var h in args.options.headers ) {
    headers.push( h + ": " + args.options.headers[ h ] );
  }
  c.options.httpheader = headers;

  c.perform();

  if ( typeof args.options.transformer === "function" ) {
    response = args.options.transformer( response );
  }

  if ( typeof args.callback === "function" ) {
    args.callback( response );
    return undefined;
  }
  else {
    return response;
  }
}

exports.getAsText = function() {
  var args = futzArguments( arguments );

  args.options.transformer = function( response ) {
    // TODO respect the character set
    return response.decodeToString();
  }

  return exports.get( args );
}

exports.getAsJSON = function() {
  var args = futzArguments( arguments );

  // set the accept-header if not specified
  if ( args.options.headers.accept === undefined ) {
    args.options.headers.accept = "application/json;q=0.9,*/*;q=0.1";
  }

  args.options.transformer = function( response ) {
    // TODO use a less shitty JSON parser (and handle charset)
    return JSON.parse( response.decodeToString() );
  }

  return exports.get( args );
}

exports.getAsHTML = function() {
  var args = futzArguments( arguments );

  // set the accept-header if not specified
  if ( args.options.headers.accept === undefined ) {
    args.options.headers.accept = "text/html;q=0.9";
  }

  args.options.transformer = function( response ) {
    var stream = require( "io" ).BinaryStream( response );
    return require( "xml" ).HTMLParser.parse( stream );
  }

  return exports.get( args );
}
