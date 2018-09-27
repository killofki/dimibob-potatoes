const [ fs, url, axios, cheerio ] = [ 'fs', 'url', 'axios', 'cheerio' ] .map( v => require( v ) ); 

const URL = 'https://www.dimigo.hs.kr/index.php'; 
const FILTER = article => /^(\d+)월.*?(\d+)일.*?식단.*$/ .test( article .title ); 
const MEALS = { 
	  '조식': 'breakfast' 
	, '중식': 'lunch' 
	, '석식': 'dinner' 
	, '간식': 'snack' 
	}; 

let potatoes = {}; 
const CACHE = './cache'; 
const WORDS = ['감자', '포테이토', '포테토']; 

async function fetchArticles () { 
	const articles = []; 
	const params = { mid: 'school_cafeteria', page: 1 }; 
	
	while ( true ) { 
		const $ = cheerio .load( ( await axios .get( URL, { params } ) ) .data ); 
		
		const list = $( '#dimigo_post_cell_2 tr' ) .map( ( i, e ) => ({ 
			  title: $( e ) .find( 'td.title' ) .text() .trim() 
			, date: $( e ) .find( 'td.regdate' ) .text() .trim() 
			, href: $( e ) .find( 'td.title a' ) .attr( 'href' ) 
			}) ) .get(); 
		
		const next = $( 'a.direction.next' ) .attr( 'href' ); 
		const page = parseInt( url .parse( next, true ) .query .page ); 
		
		articles .push( ... list ); 
		console .log( 'page', params .page, list ); 
		if ( params .page ++ >= page ) { 
			return articles; 
			} 
		} 
	} // -- fetchArticles() 

function cache ( href ) { 
	const path = `${ CACHE }/${ url .parse( href, true ) .query .document_srl }.html`; 

	if ( fs .existsSync( path ) ) { 
		return fs .readFileSync( path, 'utf8' ); 
		} 
	else { 
		return axios .get( href ) .then( ({ data }) => save( data, path ) ); 
		} 
	} // -- cache() 

function save ( value, path ) { 
	fs .writeFileSync( path, typeof value === 'string' ? value : JSON .stringify( value, null, 2 ) ); 
	return value; 
	} // -- save() 

async function parseArticle ( article ) { 
	try { 
		const html = await cache( article .href ); 
		if ( WORDS .every( w => ! html .includes( w ) ) ) 
			{ return; } 
		
		const $ = cheerio .load( html ); 
		const map = $( 'div.xe_content p' ) .map( ( i, e ) => { 
			const [ k, v ] = $( e ) .text() .split( ':' ) .map( v => v .trim() ); 
			return MEALS[ k ] && v .split( /[*/&]/ ) .map( v => v .trim() ); 
			} ); 
		
		map .get() .forEach( v => { 
			if ( ! v || WORDS .every( w => ! v .includes( w ) ) ) 
				{ return; } 
			
			potatoes[ v ] = potatoes[ v ] || 0; 
			potatoes[ v ] += 1; 
			}); 
		} 
	catch ( e ) { 
		console .log( 'parse failed:', article .href, e .message ); 
		} 
	} // -- parseArticle() 

function savePotatoes () { 
	fs .writeFileSync( 
		  'potatoes.txt'
		, [ ... Object .entries( potatoes ) ] 
			.sort( ( a, b ) => b[ 1 ] - a[ 1 ] || a[ 0 ] .localeCompare( b[ 0 ] ) ) 
			.map( v => `[${ v[ 1 ] .toString() .padStart( 2, '0' ) }] ${ v[ 0 ] }` ) 
			.join( '\n' ) 
		); 
	} // -- savePotatoes() 

fs .existsSync( CACHE ) || fs .mkdirSync( CACHE ); 
fetchArticles() 
.then( v => save( v, 'dimibob.json' ) ) 
.then( v => v .filter( FILTER ) ) 
.then( v => Promise .all( v .map( parseArticle ) ) ) 
.then( savePotatoes ) 
.catch( console .error ) 
	; 

// original src from https://github.com/ChalkPE/dimibob-potatoes/blob/master/index.js 
// viral from https://twitter.com/chalk_alt/status/1045216658996977664 
