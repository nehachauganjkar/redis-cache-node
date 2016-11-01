// require the dependencies we installed
var app = require('express')();
var responseTime = require('response-time')
var axios = require('axios');
var redis = require('redis');

// create a new redis client and connect to our local redis instance
var client = redis.createClient();

// if an error occurs, print it to the console
client.on('error', function (err) {
    console.log("Error " + err);
});

app.set('port', (process.env.PORT || 5000));
// set up the response-time middleware
app.use(responseTime());

// call the IMDb API to fetch information about the movie
function getMovieDetails(moviename) {
  var imdbEndpoint = 'http://www.omdbapi.com/?t=' + moviename + '&y=&plot=short&r=json';
  return axios.get(imdbEndpoint);
}

// if a user visits /api/Titanic, return the IMDb ratings for movie 'Titanic'
app.get('/api/:moviename', function(req, res) {
  // get the moviename parameter in the URL
  // i.e.: moviename = "Titanic" in http://localhost:5000/api/Titanic
  var moviename = req.params.moviename;

  // use the redis client to get the movie details associated to that
  // moviename from our redis cache
  client.get(moviename, function(error, result) {

      if (result) {
        // the result exists in our cache - return it to our user immediately
        res.send({ "imdbRating": result, "source": "redis cache" });
      } else {
        // we couldn't find the key "Titanic" in our cache, so get it
        // from the IMDb API
        getMovieDetails(moviename)
          .then(function(moviesdata) {
            var imdbRating = moviesdata.data.imdbRating;
            // store the key-value pair (moviename:imdbRating) in our cache
            // with an expiry of 1 minute (60s)
            client.setex(moviename, 60, imdbRating);
            // return the result to the moviename
            res.send({"imdbRating": imdbRating, "source": "IMDb API" });
          }).catch(function(response) {
            if (response.status === 404){
              res.send('The IMDb moviename could not be found. Try "Titanic" as an example!');
            } else {
              res.send(response);
            }
          });
      }

  });
});

app.listen(app.get('port'), function(){
  console.log('Server listening on port: ', app.get('port'));
});
