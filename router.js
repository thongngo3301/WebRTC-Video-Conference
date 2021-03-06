/**
 * This module serves as the router to the different views. It handles
 * any incoming requests.
 *
 * @param app An express object that handles our requests/responses
 * @param socketIoServer The host address of this server to be injected in the views for the socketio communication
 */

'use strict';

module.exports = function (app, socketIoServer) {
    app.get('/', function (req, res) {
        res.render('home');
    });

    app.get('/mesh/:path', function (req, res) {
        let path = req.params.path;
        console.log(path);
        console.log("Requested room-mesh " + path);
        res.render('room-mesh', { "hostAddress": socketIoServer });
    });

    app.get('/sfu/:path', function (req, res) {
        let path = req.params.path;
        console.log(path);
        console.log("Requested room-sfu " + path);
        res.render('room-sfu', { "hostAddress": socketIoServer });
    });
}