require('dotenv').config()
const express = require('express')
const ejs = require('ejs')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const PORT = process.env.PORT || 3000
const session = require('express-session')
const passport = require('passport')
const passportLocalMongoose = require('passport-local-mongoose')
const moment = require('moment');
const multer = require('multer')
const path = require('path')
const fetch = require('node-fetch');
const nodemailer = require('nodemailer');


const Storage = multer.diskStorage({
    destination: (req,file,cb)=>{
        cb(null,'public/uploads/')
    },

    filename:(req,file,cb)=>{
        console.log(file)
        cb(null,Date.now() +  path.extname(file.originalname))
    }
})

const upload = multer({storage: Storage})




const app = express()


//mongoose.connect('mongodb://localhost:27017/BlogDB')
mongoose.connect(process.env.MONGO_DB)


app.use(express.static('public'))
app.set('view engine','ejs') 
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended:true}))

app.use(express.static(path.join(__dirname, 'public')));





app.use(session({
    secret:process.env.SECRET,
    resave:false,
    saveUninitialized: false
}))

app.use(passport.initialize())
app.use(passport.session())


const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    password: {
        type: String
        
    },
    profileImage: {
        type: String 
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    posts: [{
        title: String,
        content: String,
        likes:Number ,default:0,
        image: String,
        comments: [
            {
              name: String,
              text: String,
            },
          ],
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
});




userSchema.plugin(passportLocalMongoose)

// Create a User model using the schema
const User = mongoose.model('User', userSchema);


passport.use(User.createStrategy())
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => {
        done(err, user);
    });
});

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    // Redirect unauthenticated users to the login page or any other appropriate route
    res.redirect('/login');
}
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    // Redirect unauthenticated users to the login page or any other appropriate route
    res.redirect('/');
}

//get requests
app.get('/', async (req, res) => {
    try {
        const users = await User.find();
        const user = req.user
        if (users.length > 0) {
            const posts = [];
            for (let i = 0; i < users.length; i++) {
                if (users[i].posts && users[i].posts.length > 0) {
                    for (let j = 0; j < users[i].posts.length; j++) {
                        const post = users[i].posts[j];
                        const author_post = users[i].name;
                        const author_img = users[i].profileImage;
                        const postImages = post.image; 
                        
                        
                        posts.push({
                            title: post.title,
                            content: post.content,
                            author: author_post,
                            authorImg: author_img,
                            image: postImages, // Pass the post images to the template
                            likes: post.like || 0,
                            createdAt: moment(post.createdAt).format('MMMM Do YYYY, h:mm:ss a')
                        });
                    }
                }
            }
            res.render('home', { posts, users, user });
        } else {
            res.render('home', { posts: [], users , user}); // No users found
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});



app.get('/post',(req,res)=>{
    res.render('post')
})
app.get('/login',(req,res)=>{
    res.render('login')
})
app.get('/logout', (req, res) => {
    req.logout((err) => {
       if (err) {
          console.log(err);
       } else {
          res.redirect('/');
       }
    });
 });
 
app.get('/register',(req,res)=>{
    res.render('register')
})

app.get('/dash', ensureAuthenticated, async (req, res) => {
    const user = req.user
    try {
        const users = await User.find();

        if (users.length > 0) {
            const posts = [];
            for (let i = 0; i < users.length; i++) {
                if (users[i].posts && users[i].posts.length > 0) {
                    for (let j = 0; j < users[i].posts.length; j++) {
                        const post = users[i].posts[j];
                        let author_post = users[i].name;
                        const author_img = users[i].profileImage;
                        const postImages = post.image; 
                        

                        if(author_post === user.name){
                            author_post = "Me"
                        }
                        
                        posts.push({
                            title: post.title,
                            content: post.content,
                            author: author_post,
                            authorImg: author_img,
                            image: postImages, // Pass the post images to the template
                            likes: post.like || 0,
                            createdAt: moment(post.createdAt).format('MMMM Do YYYY, h:mm:ss a')
                        });
                    }
                }
            }
            res.render('dash', { posts, users,user });
        } else {
            res.render('dash', { posts: [], users ,user}); // No users found
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});
app.get('/profile',ensureAuthenticated,(req,res)=>{
    const user = req.user
    
    res.render('profile',{user})
})

//posts requests
app.post('/profile', upload.single('profile-img'), (req, res) => {
    // Get the data from the form
    const { name, username } = req.body;
    const profile_img = req.file ? req.file.filename : undefined; // Check if a new profile image was uploaded
  
    // Assuming you have a User model, update the user's profile
    User.findById(req.user._id, (err, user) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Internal Server Error');
      }
  
      if (!user) {
        return res.status(404).send('User not found');
      }
  
      // Update the user's profile data
      user.name = name;
      user.username = username;
  
      if (profile_img) {
        // Update the user's profile image if a new one was uploaded
        user.profileImage = profile_img;
      }
  
      user.save((saveErr) => {
        if (saveErr) {
          console.error(saveErr);
          return res.status(500).send('Failed to update profile');
        }
  
        // Redirect to the user's profile page or another appropriate location
        res.redirect('/dash');
      });
    });
  });
  
  app.post('/post', upload.single('blogImage'), isAuthenticated, async (req, res) => {
    

  
    
    // Function to send email to all users
    async function sendEmailToAllUsers() {
        // Fetch all users from the database
        const users = await User.find({});
    
        if (users.length === 0) {
            console.log('No users found.');
            return;
        }
    
        // Email content
        const subject = 'New Blog Post';
        const emailTemplate = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>New Blog Post</title>
            </head>
            <body style="font-family: Arial, sans-serif;">
                <div style="background-color: #f8f8f8; padding: 20px; text-align: center;">
                    <h2 style="color: #4CAF50;">New Blog Post</h2>
                </div>
                <div style="padding: 20px;">
                    <p>A new blog post has been published on our website:</p>
                    <h3>Author: <strong>${req.user.name}</strong></h3>
                    <p><strong>Content:</strong>${req.body.blogContent}</p>
                </div>
            </body>
            </html>
        `;
    
        // Create a Nodemailer transporter
        const transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: "teamdevelopers72@gmail.com",
                pass:"tpqe yuyw rvnt cxmi"
            },
        });
    
        // Send emails to all users
        for (const user of users) {
            const mailOptions = {
                from: 'strongadas009@gmail.com',
                to: user.username, 
                subject: subject,
                html: emailTemplate,
            };
    
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Error sending email notification:', error);
                } else {
                    console.log(`Email notification sent to ${user.username}:`, info.response);
                }
            });
        }
    }
    
   
   
    

function sendEmailPost() {
  const subject = 'New Blog Post';

  const emailTemplate = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Blog Post</title>
    </head>
    <body style="font-family: Arial, sans-serif;">
      <div style="background-color: #f8f8f8; padding: 20px; text-align: center;">
        <h2 style="color: #4CAF50;">New Blog Post</h2>
      </div>

      <div style="padding: 20px;">
        <p> You have Succssfully posted new blog on Blog King</p>
        <ul style="list-style-type: none; padding: 0; margin: 0;">
          <li>Author: <strong>${req.user.name}</strong></li>
          <li><strong>Content:</strong> ${req.body.blogContent}</li>
        </ul>
      </div>

      <div style="background-color: #f8f8f8; padding: 20px; text-align: center;">
        <p style="color: #888;">Thank you for using Blog King!</p>
      </div>
    </body>
    </html>
  `;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: "teamdevelopers72@gmail.com",
        pass:"tpqe yuyw rvnt cxmi"
    },
  });

  const mailOptions = {
    from: 'strongadas009@gmail.com',
    to: req.user.username,
    subject: subject,
    html: emailTemplate,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email notification:', error);
    } else {
      console.log('Email notification sent:', info.response);
    }
  });
}


    try {
        const { blogTitle, blogContent } = req.body;

        let blogImage = null;
        if (req.file) {
            blogImage = req.file.filename;
        }

        // Find the user by ID
        const user = await User.findById(req.user._id);

        if (!user) {
            res.status(404).send('User not found');
            return;
        }

        // Create a new post
        const newPost = {
            title: blogTitle,
            content: blogContent,
        };

        if (blogImage) {
            newPost.image = blogImage;
        }

        // Add the new post to the user's posts array
        user.posts.push(newPost);

        // Update the user in the database
        await user.save();


        if (isAuthenticated) {
            res.redirect('/dash');
            sendEmailPost();
            sendEmailToAllUsers();
        } else {
            res.redirect('/');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }


   
});



app.post('/register', upload.single('profile-img'),(req, res) => {

   
    // Check if a file was uploaded
    if (req.file) {
      // If a file was uploaded, use it for the profileImage property
      User.register({ username: req.body.username, name: req.body.name, profileImage: req.file.filename }, req.body.password, (err, user) => {
        if (err) {
          console.log(err);
          res.redirect('/register');
        } else {
          passport.authenticate('local')(req, res, () => {
            res.redirect('/dash');
            sendEmail()
          });
        }
      });
    } else {
      // If no file was uploaded, set the profileImage property to null or a default image path
      User.register({ username: req.body.username, name: req.body.name, profileImage: null }, req.body.password, (err, user) => {
        if (err) {
          console.log(err);
          res.redirect('/register');
        } else {
          passport.authenticate('local')(req, res, () => {
            res.redirect('/dash');
            sendEmail()
          });
        }
      });
    } 
    
    function sendEmail(){
        const subject = 'A User Signed Up';
        

        const emailTemplate = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>New User registration</title>
                </head>
                <body style="font-family: Arial, sans-serif;">

                    <div style="background-color: #f8f8f8; padding: 20px; text-align: center;">
                        <h2 style="color: #4CAF50;">User Successfully Registered</h2>
                    </div>

                    <div style="padding: 20px;">
                        <p>A new user just registred on your Blog Website </p>
                        
                        <ul style="list-style-type: none; padding: 0; margin: 0;">
                            <li>Name: <strong>${req.body.name}</strong></li>
                            <li>Email: <strong>${req.body.username}</strong></li> 
                             
                        </ul>
                    </div>

                    <div style="background-color: #f8f8f8; padding: 20px; text-align: center;">
                        <p style="color: #888;">Thank you for choosing our service!</p>
                    </div>

                </body>
                </html>
            `;


        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 456,
            secure: true,
            auth: {
                user: "darkunlocks1@gmail.com",
                pass: "nnzw lyec ivtj soyw"
            }
        });

        const mailOptions = {
            from: 'darkunlocks1@gmail.com',
            to: 'strongadas009@gmail.com',
            subject: subject,
            html: emailTemplate,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email notification:', error);
            } else {
                console.log('Email notification sent:', info.response);
            }
        });
    }
  });
  
      

app.post('/login',(req,res)=>{
    
    const user = new User({
        username:req.body.username,
        password:req.body.password
    })

    req.login(user,(err)=>{
        if(err){
            console.log(err)
            res.redirect('/login')
        }else{
            
        passport.authenticate('local')(req, res, () => {
            
            res.redirect('/dash');
        });
        }
    })
})

app.listen(PORT,()=>{
    console.log(`Server Started on Port ${PORT}`)
})