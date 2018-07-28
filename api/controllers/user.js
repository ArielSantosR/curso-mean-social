'use strict'

var bcrypt = require('bcrypt-nodejs');

var User = require('../models/user'); 

var jwt = require('../services/jwt');

var fs = require('fs');

var path = require('path');

var mongoosePaginate = require('mongoose-pagination');

function home(req,res){
    res.status(200).send({
        message: 'hola mundo servidor nodejs'
    });
};

function pruebas(req,res){
    console.log(req.body);
    res.status(200).send({
        message: 'accion de pruebas'
    });
}

//registro
function saveUser(req,res){
    var params = req.body;
    var user = new User();
    if(params.name && params.surname && params.nick && params.email && params.password){

        user.name = params.name;
        user.surname = params.surname;
        user.nick = params.nick;
        user.email = params.email;
        user.role = 'ROLE_USER';
        user.image = null;

        User.find({ $or: [
                                {email: user.email.toLowerCase()},
                                {nick: user.nick.toLowerCase()}
                        ]
                    }).exec((err, users) => {
                        if(err) return res.status(500).send({message:'Error en petición.'});

                        if(users && users.length >= 1){
                            return res.status(200).send({message:'Usuario que intenta registrar ya existe'});
                        }else{
                            bcrypt.hash(params.password, null, null, (err, hash) => {
                                user.password = hash;
                    
                                user.save((err, userStored) =>{
                                    if(err) return res.status(500).send({message:'Error al guardar el usuario.'})
                    
                                    if(userStored){
                                        res.status(200).send({user: userStored});
                                    }else{
                                        res.status(404).send({message: 'No se ha registrado el usuario'});
                                    }
                                });
                            });
                        }

                    });

        

    }else{
        res.status(200).send({
            message: 'Envia todos los campos necesarios'
        });
    }

}

//login
function loginUser(req, res){
 var params = req.body;
 var email = params.email;
 var password = params.password;

User.findOne({email: email}, (err,user) =>{
    if(err) return res.status(500).send({message:'Error en la petición'});

    if(user){
        bcrypt.compare(password, user.password, (err, check) => {
            if(check) {
                if(params.gettoken){
                    //Devolver token
                    return res.status(200).send({
                        token: jwt.createToken(user)
                    });
                }else{
                    //devolver usuario
                    user.password = undefined;
                    return res.status(200).send({user});
                }
                


            }else{
                return res.status(404).send({message:'El usuario no se ha podido identificar'});
            }
        });
    }else{
        return res.status(404).send({message:'Usuario no encontrado'});
    }
});

}

//conseguir datos de un usuario
function getUser(req,res){
    var userId = req.params.id;

    User.findById(userId, (err, user) => {

        if(err) return res.status(500).send({message:'Error en la petición'});

        if(!user) return res.status(404).send({message:'El usuario no existe'});

        return res.status(200).send({user});
    });
}

//devolver un listado paginado de usuario
function getUsers(req, res){
    var identity_user_id = req.user.sub;
    var page = 1;
    if(req.params.page){
        page = req.params.page;
    }
    var itemsPerPage = 5;
    User.find().sort('_id').paginate(page, itemsPerPage, (err, users, total) =>{
        if(err) return res.status(500).send({message:'Error en la petición'});
        if(!users) return res.status(404).send({message:'No hay usuarios disponibles'});

        return res.status(200).send({
            users,
            total,
            pages: Math.ceil(total/itemsPerPage)
        });

    });
}

//actualizar datos de un usuario
function updateUser(req, res){
    var userId = req.params.id;
    var update = req.body;

        //borrar propiedad password
        delete update.password;
    
    if(userId != req.user.sub){
        return res.status(500).send({message:'No tienes permisos para actualizar los datos del usuario'});
    }

    User.findByIdAndUpdate(userId, update, {new:true}, (err, userUpdated) =>{
        if(err) return res.status(500).send({message:'No tienes permisos para actualizar los datos del usuario'});
        if(!userUpdated) return res.status(404).send({message:'No se ha podido actualizar el usuario'});
        return res.status(200).send({user: userUpdated});
    });

}

//subir archivos de imagen / avatar de usuario
function uploadImage(req, res){
    var userId = req.params.id;


    if(req.files){
        var file_path = req.files[Object.keys(req.files)[0]].path; 
        var file_split = file_path.split('\/');

        var file_name = file_split[2];

        var ext_split = file_name.split('\.');
        var file_ext = ext_split[1];

        if(userId != req.user.sub){
            return removeFilesOfUploads(res, file_path, 'No tienes permisos para actualizar los datos del usuario');
        }

        if(file_ext == 'png' || file_ext == 'jpg' || file_ext == 'jpeg' || file_ext == 'gif'){
            //actualizar documento de usuario logeado
            User.findByIdAndUpdate(userId,{image: file_name}, {new:true}, (err, userUpdated) => {
                if(err) return res.status(500).send({message:'No tienes permisos para actualizar los datos del usuario'});
                 if(!userUpdated) return res.status(404).send({message:'No se ha podido actualizar el usuario'});
                 return res.status(200).send({user: userUpdated});
            });
        }else{
            return removeFilesOfUploads(res, file_path, 'Extensión no válida');
        }

    }else{
        res.status(200).send({message:'No se han subido imágenes'});
    }
}

function removeFilesOfUploads(res, file_path, message){
    fs.unlink(file_path, (err) => {
        return res.status(200).send({message:'Extensión no es válida'});
    });
}


module.exports = {
    home,
    pruebas,
    saveUser,
    loginUser,
    getUser,
    getUsers,
    updateUser,
    uploadImage
    
}

