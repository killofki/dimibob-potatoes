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
const WORDS = [ '감자', '포테이토', '포테토' ]; 

async function fetchArticles () { 
	const articles = []; 
	const params = { mid: 'school_cafeteria', page: 1 }; 
	
	const pipe = ( ... ar ) => ar .reduce( ( v, F ) => F( v ) ); 
	
	const mapperDefault = e => text() .trim(); 
	const mapperEntries = [{ 
		  title : [ 'td.title' ] 
		, date : [ 'td.regdate' ] 
		, href : [ 'td.title a', e => e .attr( 'href' ) ] 
		}] .entries(); 
	
	const mapper = e => Object .assign( ... 
		mapperEntries .map( ( p, [ q, selF = mapperDefault ] ) => 
			({ [ p ] : pipe( $( e ) .find( q ), selF ) }) 
			) 
		); 
	
	while ( true ) { 
		const $ = cheerio .load( 
			( await axios .get( URL, { params } ) ) 
			.data 
			); 
		
		const list = $( '#dimigo_post_cell_2 tr' ) .map( ( i, e ) => 
			mapper( e ) 
			) .get(); 
		
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

	return fs .existsSync( path ) ? fs .readFileSync( path, 'utf8' ) 
		: axios .get( href ) .then( ({ data }) => save( data, path ) ) 
		; 
	} // -- cache() 

function save ( value, path ) { 
	fs .writeFileSync( path, typeof value === 'string' ? value : JSON .stringify( value, null, 2 ) ); 
	return value; 
	} // -- save() 

async function parseArticle ({ href }) { 
	try { 
		const html = await cache( href ); 
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
			let pv = potatoes[ v ] || 0; 
			potatoes[ v ] = pv + 1; 
			}); 
		} 
	catch ( e ) { 
		console .log( 'parse failed:', href, e .message ); 
		} 
	} // -- parseArticle() 

function savePotatoes () { 
	fs .writeFileSync( 
		  'potatoes.txt'
		, [ ... Object .entries( potatoes ) ] 
			.sort( ( [ ap, av ], [ bp, bv ] ) => bv - av || ap .localeCompare( bp ) ) 
			.map( ([ p, v ]) => `[${ v .toString() .padStart( 2, '0' ) }] ${ p }` ) 
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
