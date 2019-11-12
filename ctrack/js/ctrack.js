// Copyright (c) 2014 International Aid Transparency Initiative (IATI)
// Licensed under the MIT license whose full text can be found at http://opensource.org/licenses/MIT

var ctrack=exports;

var plate=require("./plate.js")
var iati=require("./iati.js")
var fetch=require("./fetch.js")
var savi=require("./savi.js")
var chart=require("./chart.js")

var views=require("./views.js");

var ganal=require("./ganal.js");
var Nanobar=require("./nanobar.js");

var iati_codes=require("../../dstore/json/iati_codes.json");

var crs=require("../../dstore/json/crs.js");

ctrack.map_old_views={
	"publisher"                : "main",
	"publisher_countries"      : "countries",
	"ppublisher_countries_top" : "countries_top",
	"publisher_sectors"        : "sectors",
	"publisher_sectors_top"    : "sectors_top",
}


var usd_years=require("../../dstore/json/usd_year.json");
ctrack.usd_year={}; // merge latest data into here
for(var year=1990;year<2100;year++)
{
	if(usd_years[year]) {
		for(var n in usd_years[year])
		{
			ctrack.usd_year[n]=usd_years[year][n];
		}
	 }
}

ctrack.encodeURIComponent=function(str)
{
  return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
    return '%' + c.charCodeAt(0).toString(16);
  });
}


// exports
ctrack.savi_fixup=savi.fixup;
ctrack.draw_chart=chart.draw;

ctrack.url=function(url)
{
	if(ctrack.popout=="frame")
	{
		window.open(url);
	}
	else
	{
		window.location.href=url;
		return false;
	}
};


ctrack.get_chart_data=function(name)
{
		return ctrack.chunk(name) || [];
};

ctrack.sortby="order";
ctrack.dosort=function(s)
{
	if(ctrack.sortby==s) { s="-"+s; } // reverse on second click
	ctrack.sortby=s;
	if(ctrack.last_view)
	{
		var v=views[ctrack.last_view.toLowerCase()]
		if(v && v.display)
		{
			v.display();
		}
	}
};

// hash of a string
var shash=function(s) {
	if (s.length === 0) return 0
	var hash = 0
	var i
	var chr
	for (i = 0; i < s.length; i++)
	{
		chr   = s.charCodeAt(i);
		hash  = ((hash << 5) - hash) + chr;
		hash |= 0; // Convert to 32bit integer
	}
	return hash;
};


ctrack.setup=function(args)
{
	ctrack.nanobar = new Nanobar( {} );

	ctrack.q={};
	window.location.search.substring(1).split("&").forEach(function(n){
		var aa=n.split("=");
		ctrack.q[aa[0]]=decodeURIComponent(aa[1]||"").split("<").join("%3C").split(">").join("%3E");
	});
	
	args=args || {};
	args.jslib	=args.jslib 	|| "http://d-portal.org/jslib/"; // load stuff from here
	args.tongue	=args.tongue 	|| 	"eng"; 		// english
	args.art	=args.art 		|| 	"/art/"; 	// local art
	args.q		=args.q 		|| 	"/q"; 		// local q api
	
	args.flavas=args.flavas || ["original","high"];
	args.flava=args.flava || ctrack.q.flava || "original";
	args.rgba=args.rgba || ctrack.q.rgba ;
	args.newyear=args.newyear || ctrack.q.newyear || "01-01" ;
	args.policy=args.policy || ctrack.q.policy ;

	if(args.policy)
	{
		args.policy=args.policy.split(",").join("|") // convert , to |
	}

	if(!args.css) // can totally override with args
	{
		args.css=[
				args.art+args.flava+"/activities.css",
				args.art+args.flava+"/ctrack.css",
				args.art+"chosen.min.css",
				args.art+"chartist.min.css",
				args.art+"typeahead.css"
		];
		if(args.rgba) // only if given
		{
				args.css[args.css.length]=args.art+"rgba/"+args.rgba+".css";
		}
	}

	if(args.css) { head.load(args.css); }
	
	ctrack.year=parseInt(args.year || ctrack.q.year || 2016); // default base year for graphs tables etc

	ctrack.year_chunks=function(y){					// function to build visible range of years for display
		ctrack.chunk("year" ,y  );
		ctrack.chunk("year1",y-1);
		ctrack.chunk("year2",y  );
		ctrack.chunk("year3",y+1);
		ctrack.chunk("year4",y+2);
	};

	ctrack.args=args;


	ctrack.display_usd="USD"; 
	ctrack.convert_usd=1;
//	ctrack.convert_have={}; // test old style
	ctrack.convert_have={"CAD":true,"EUR":true,"GBP":true};
	ctrack.convert_str=function(n){
		if(n=="sum_of_percent_of_trans") { n="sum_trans" }
		else
		if(n=="sum_of_percent_of_budget") { n="sum_budget" }
		
		if(ctrack.convert_have[ctrack.display_usd])
		{
			return n+"_"+ctrack.display_usd.toLowerCase();
		}
		else
		{
			if(n=="spend"||n=="commitment") { return n; }
			return n+"_usd";
		}
	};
	ctrack.convert_num=function(n,v){
		
		if(n=="spend/commitment")
		{
			var a=ctrack.convert_num("spend",v)
			var b=ctrack.convert_num("commitment",v)
			if( b && b!=0 ) { return a/b }
			else { return 0 }
		}

		if(n=="sum_of_percent_of_trans") { n="sum_trans" }
		else
		if(n=="sum_of_percent_of_budget") { n="sum_budget" }

		if(ctrack.convert_have[ctrack.display_usd])
		{
			return  v[n+"_"+ctrack.display_usd.toLowerCase()];
		}
		else
		{
			if(n=="spend"||n=="commitment") { return v[n]*ctrack.convert_usd; }
			return  v[n+"_usd"]*ctrack.convert_usd;
		}
	};
	ctrack.convert_not_zero=function(n,v){
		var t=ctrack.convert_num(n,v)
		return ( (t) && (t!=0) )
	};


	if( ctrack.q.usd )
	{
		var usd=ctrack.q.usd.toUpperCase();
		if(ctrack.usd_year[usd])
		{
			ctrack.display_usd=usd;
			ctrack.convert_usd=ctrack.usd_year[usd]; // conversion from usd to whatever we wish to display
		}
	}
	args.chunks["USD"]=ctrack.display_usd;
//console.log("convert USD "+ctrack.convert_usd);


// copy old args to q args as defined in search
	if( ctrack.q.country   ) { ctrack.q.country_code  = ctrack.q.country }
	if( ctrack.q.publisher ) { ctrack.q.reporting_ref = ctrack.q.publisher }


	var search_args=[]
	for( var idx in views.search.terms )
	{
		var it=views.search.terms[idx]
		if( it.q && ctrack.q[it.q] )
		{
			search_args.push(it.q+"="+ctrack.q[it.q])
			if( !args[it.q] ) { args[it.q] = ctrack.q[it.q] }
		}
	}
	
// pick a random background based on search values	
	var search_hash=Math.abs(shash(search_args.join("&")||""))
	var backgrounds=["BF"]
	for(var cc in iati_codes.country) { if( iati_codes.crs_countries[cc] ) { backgrounds.push(cc) } }
	var backgrounds_idx=( search_hash%backgrounds.length )
	
	args.chunks["background_image"]="{art}back/"+backgrounds[backgrounds_idx].toLowerCase()+".jpg";
	args.chunks["country_flag"]="{art}flag/empty_flag.png";

	args.chunks["country_code"]="";
	args.chunks["country_name"]="";
	args.chunks["publisher_code"]="";
	args.chunks["publisher_name"]="";
	args.chunks["publisher_slug"]="";

	if(search_args.length==1) // only 1
	{
		if( search_args[0].indexOf("|")!=-1 || search_args[0].indexOf(",")!=-1 ) // actually not 1 as it is a multiple
		{
			ctrack.args.showsearch=true;
		}
		else
		if( ctrack.q.country_code )
		{
			args.chunks["main_publisher"]="";
			args.chunks["main_pubmin"]="";

			args.chunks["main_publisher_head"]="";
			args.chunks["main_publisher_map"]="";
			args.chunks["back_publisher"]="";
		}
		else
		if( ctrack.q.reporting_ref )
		{
			args.chunks["main_country"]="";
			args.chunks["main_countrymin"]="";
		}
		else
		{
			ctrack.args.showsearch=true;
		}
	}
	else
	{
		ctrack.args.showsearch=true;
	}

// show special search header
	if(ctrack.args.showsearch) // hide all country/publisher special things
	{
		args.chunks["main_countrymin"]="";
		args.chunks["main_country"]="";
		args.chunks["main_country_head"]="";
		args.chunks["back_country"]="";
		
		args.chunks["main_pubmin"]="";
		args.chunks["main_publisher"]="";
		args.chunks["main_publisher_head"]="";
		args.chunks["main_publisher_map"]="";
		args.chunks["back_publisher"]="";
	}
	else // hide search header
	{
		args.chunks["main_search"]="";
		args.chunks["main_searchmin"]="";
	}


	if( ctrack.q.country_code )
	{
		var code=ctrack.q.country_code
		var codes=code.toLowerCase().split(","); if(cc.length==1) { code.toLowerCase().split("|"); }

		args.country=codes[0].toLowerCase();
		args.country_select=codes.join("|");
		args.chunks["country_code"]=codes[0].toUpperCase();
		args.chunks["country_name"]=iati_codes.country[ args.country.toUpperCase() ];

// forced background for country
		if( iati_codes.crs_countries[ args.country.toUpperCase() ] )
		{
			args.chunks["country_flag"]="{art}flag/"+args.country+".png";
			args.chunks["background_image"]="{art}back/"+args.country+".jpg";
		}
		
	}

	if( ctrack.q.reporting_ref )
	{
		var code=ctrack.q.reporting_ref
		var codes=code.split(","); if(cc.length==1) { code.split("|"); }

		args.publisher=codes[0]; // case is important?
		args.publisher_select=codes.join("|");
		args.chunks["publisher_code"]=args.publisher;
		args.chunks["publisher_name"]=iati_codes.publisher_names[args.publisher] || args.publisher;
		args.chunks["publisher_slug"]=iati_codes.publisher_slugs[args.publisher] || "";

	}


	ctrack.search_fixup=function(args){
		args=args || ctrack.args;
		if(args.showsearch)
		{
			
			var div=$("#main_searchmin_all")
			
			div.empty()
			
			for( var idx in views.search.terms )
			{
				var it=views.search.terms[idx]
				if(it.show)
				{
					var text=args[it.q]
					if(text)
					{
						if(it.codes)
						{
							for( var c of it.codes )
							{
								if(c[text])
								{
									text=c[text]
								}
								if(typeof text=="string") // try fixing the case for lookup
								{
									if(c[text.toUpperCase()])
									{
										text=c[text.toUpperCase()]
									}
									else
									if(c[text.toLowerCase()])
									{
										text=c[text.toLowerCase()]
									}
								}
							}
						}
						var chunk=plate.replace("{"+it.show+"}",{search_text:text})
						div.append(chunk)
					}
				}
			}
		}
	};

	ctrack.crumbs=[{hash:"#view=main",view:"main"}];
	
	ctrack.setcrumb=function(idx)
	{
// try not to leave holes in the crumbs list, so align to left
		if(idx > ctrack.crumbs.length ) { idx=ctrack.crumbs.length; }
		
		var it={};
		ctrack.crumbs=ctrack.crumbs.slice(0,idx);
		ctrack.crumbs[idx]=it;
		it.hash=ctrack.last_hash;
		it.view=ctrack.last_view;
	};
	ctrack.show_crumbs=function()
	{
		for(var i=0;i<ctrack.crumbs.length;i++)
		{
			var v=ctrack.crumbs[i];
			if(v)
			{
				ctrack.chunk("crumb"+i+"_hash",v.hash);
				ctrack.chunk("crumb"+i+"_view",v.view);
			}
			else
			{
				ctrack.chunk("crumb"+i+"_hash","#view=main");
				ctrack.chunk("crumb"+i+"_view","main");
			}
		}
		ctrack.chunk("crumbs","{crumbs"+ctrack.crumbs.length+"}");
	}

	ctrack.chunks={};
	if( args.tongue!="non" ) // use non as a debugging mode
	{
		plate.push_namespace(require("../json/eng.json")); // english fallback for any missing chunks

		var tongues=require("../json/tongues.js"); // load all tongues
		var tongue=tongues[ args.tongue ];
		if(tongue){plate.push_namespace(tongue);} // translation requested
	}
	plate.push_namespace(require("../json/chunks.json")); //the main chunks
	if(args.chunks)
	{
		plate.push_namespace(args.chunks); // override on load
	}
	plate.push_namespace(ctrack.chunks); // the data we create at runtime

// set or get a chunk in the ctrack namespace
	ctrack.chunk=function(n,s){
		if( s !== undefined )
		{
			ctrack.chunks[n]=s;
		}
		return ctrack.chunks[n];
	};
	ctrack.chunk_clear=function(n){
			ctrack.chunks[n]=undefined;
	};
// set global defaults
	ctrack.chunk("yearcrs" ,crs.year  ); // the crs data is for this year
	ctrack.chunk("art",args.art);
	ctrack.chunk("flava",args.art+args.flava+"/");
	ctrack.chunk("flava_name",args.flava);
	ctrack.chunk("tongue",args.tongue);
	ctrack.chunk("newyear",args.newyear);

	ctrack.div={};

	ctrack.div.master=$(ctrack.args.master);
	ctrack.div.master.empty();
	ctrack.div.master.html( plate.replace("{loading}")  );
	
	
	ctrack.chunk("today",fetch.get_today());
	ctrack.chunk("hash","");
	
// build ? strings for url changes

	var aa={}
	for(var n in ctrack.q) { aa[n]=ctrack.q[n]; } // use raw Q
	if(args.flava!="original")		{ aa["flava"]    =args.flava;         }
	if(args.tongue!="eng")			{ aa["tongue"]   =args.tongue;        }
	if(args.newyear!="01-01")		{ aa["newyear"]  =args.newyear;       }
	if(ctrack.display_usd!="USD")	{ aa["usd"]      =ctrack.display_usd; }

	var bb=[]; for(var n in aa) { bb.push(n+"="+aa[n]); }
	ctrack.chunk("mark","?"+bb.join("&"));

	var bb=[]; for(var n in aa) { if(n!="tongue") { bb.push(n+"="+aa[n]); } }
	ctrack.chunk("mark_no_tongue","?"+bb.join("&"));

	var bb=[]; for(var n in aa) { if(n!="newyear") { bb.push(n+"="+aa[n]); } }
	ctrack.chunk("mark_no_newyear","?"+bb.join("&"));

	var bb=[]; for(var n in aa) { if( (n!="flava") && (n!="rgba") ){ bb.push(n+"="+aa[n]); } }
	ctrack.chunk("mark_no_flava","?"+bb.join("&"));

	var bb=[]; for(var n in aa) { if(n!="usd") { bb.push(n+"="+aa[n]); } }
	ctrack.chunk("mark_no_usd","?"+bb.join("&"));
	
	var bb=[]; for(var n in aa) { if(n!="publisher") { bb.push(n+"="+aa[n]); } }
	ctrack.chunk("mark_no_publisher","?"+bb.join("&"));

// return to the search selection page with current settings
	ctrack.chunk("search_url","/ctrack.html#view=search&"+search_args.join("&"));

	var ss=[];
	for(var i in iati_codes.iati_currencies) { var it=iati_codes.iati_currencies[i];
		ss.push('<option value="'+it.id+'">'+it.name+'</option>');
	}
	ctrack.chunk("all_usd_options",ss.join());
	
	var ss=[];
	for (var d=1;d<365;d++)
	{
		var dd=new Date(2015, 0, d, 0, 0, 0, 0); // pick a non leap year and get days of each month
		var d1=dd.getMonth();
		var d2=dd.getDate();
		var ds=("00" + (d1+1)).slice(-2) + "-" + ("00" + d2).slice(-2);
		ss.push('<option value="'+ds+'">'+ds+'</option>');
	}
	ctrack.chunk("all_date_options",ss.join());

 
	ctrack.hash={};
	ctrack.hash_split=function(q,v)
	{
		if(q[0]=="#") { q=q.substring(1);}
		v=v;
		var aa=q.split("&");
		aa.forEach(function(it){
			var bb=it.split("=");
//console.log(bb);
			if( ( "string" == typeof bb[0] ) && ( "string" == typeof bb[1] ) )
			{
				v[ bb[0] ] = decodeURIComponent(bb[1]).split("<").join("%3C").split(">").join("%3E");
			}
		});
		return v;
	}


	ctrack.view_done={};
	ctrack.show_view=function(name)
	{
		if(name)
		{
			name=name.toLowerCase();
			var v=views[name];
			if(v && v.view)
			{
				v.view();
			}
			ganal.view(); // record view action
		}
	}

	ctrack.hash={};
	ctrack.display_wait_time=((new Date()).getTime());
	ctrack.display_wait=0;
	ctrack.display_wait_max=0;
	ctrack.display_progress=100;
	ctrack.display_wait_update=function(add){
		ctrack.display_wait=ctrack.display_wait+add;
		if( ctrack.display_wait <= 0 ) // done
		{
			ctrack.display_wait_time=((new Date()).getTime());
			ctrack.display_wait=0;
			ctrack.display_wait_max=0;
			ctrack.display_progress=100;
		}
		else
		if( ctrack.display_wait > ctrack.display_wait_max ) // waiting for
		{
			ctrack.display_wait_time=((new Date()).getTime());
			ctrack.display_wait_max=ctrack.display_wait;
		}
		
		if(ctrack.display_wait_max>0)
		{
			ctrack.display_progress=100 - (100*(ctrack.display_wait+1)/(ctrack.display_wait_max+1));
		}
		else
		{
			ctrack.display_progress=100;
		}
		
		ctrack.nanobar.go( ctrack.display_progress );
		
	};
	ctrack.display=function()
	{
//console.log(ctrack.display_wait);
		ctrack.display_wait_update(-1);
		
//		if( ( ctrack.display_wait_time < ((new Date()).getTime()-1000) ) || ( ctrack.display_progress==100) )
//		{
			ctrack.change_hash(); // update when done or after waiting a little while?
//		}

	}
	ctrack.change_hash=function(h)
	{
		if(h)
		{
			if(h.view)
			{
				h.view=ctrack.map_old_views[h.view] || h.view;
			}

			ctrack.hash={};
			for(var n in h)
			{
				ctrack.hash[n]=h[n];
			}
		}
		ctrack.display_hash();
		ctrack.last_hash="&";
		ctrack.check_hash();
	}
	ctrack.display_hash=function()
	{
		var a=[];
		for(var n in ctrack.hash)
		{
			a.push(n+"="+ctrack.encodeURIComponent(ctrack.hash[n]));
		}
		document.location.hash=a.join("&");
		ctrack.last_hash=document.location.hash; // disable change logic
	}
	ctrack.last_hash="&";
	ctrack.last_view="";
	ctrack.check_hash=function()
	{
		var h="#"+(window.location.href.split('#')[1]||"")
		if(h!=ctrack.last_hash)
		{
			ctrack.chunk("hash",h);
			ctrack.last_hash=h;
			var l={};
			ctrack.hash=ctrack.hash_split(h,l);
					
			var change_of_view=false;
			if(l.view)
			{
				l.view=ctrack.map_old_views[l.view] || l.view;
			}
			else
			{
				l.view="main";
				change_of_view=true;
			}
			if((ctrack.last_view!=l.view)||(change_of_view)) // scroll up when changing views
			{
				change_of_view=true;
				ctrack.last_view=l.view;
				$("html, body").bind("scroll mousedown DOMMouseScroll mousewheel keyup", function(){
					$('html, body').stop();
				});
				$('html, body').animate({ scrollTop:0 }, 'slow', function(){
					$("html, body").unbind("scroll mousedown DOMMouseScroll mousewheel keyup");
				})
				
				ctrack.show_view(l.view);
//console.log("new view");
   			}

//console.log("displaying view");

			ctrack.show_crumbs();

// these are now view hooks
			var name=l.view;
			if(name)
			{
				name=name.toLowerCase();
				var v=views[name];
				if(v && v.show)
				{
					v.show(change_of_view); // special fill
				}
				else // default fill
				{
					ctrack.div.master.html( plate.replace( "{view_"+l.view+"}" ) );
				}
				if(v && v.fixup)
				{
					v.fixup();
				}
				ctrack.search_fixup();
				$("select.chosen").chosen({allow_single_deselect:true,search_contains:true});
			}
		}
	};
	$(window).bind( 'hashchange', function(e) { ctrack.check_hash(); } );

// wait for images to load before performing any data requests?
	for(var n in views)
	{
		var v=views[n];
		if(typeof v == "object")
		{
			if(v.setup)
			{
//				console.log("setup "+n);
				v.setup(); // perform initalization of all views
			}
		}
	}
	ctrack.check_hash();
	ctrack.display_hash(); // this will display view=main or whatever page is requsted

}

