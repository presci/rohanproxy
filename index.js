#!/usr/bin/env node
const net = require('net');
const url = require('url');
const fs = require('fs');



var filterlist = [];
fs.watchFile('./filter', function(c, p){
    watchFilterFile();
});

function watchFilterFile(){
    console.log("reading filter file");
    filterlist = fs.readFileSync('./filter').toString().split('\n').filter(word => word.length).map(word => RegExp(word));
}
watchFilterFile();
const server = net.createServer();


server.on('connection', (clientToProxySocket) => {
    console.log('Client Connected to Proxy');
    clientToProxySocket.on('error', (err) => {
        console.log(err);
        // clientToProxySocket.write('Status: 404\r\n\r\n');
        var response404="<html><head></head><body><h1>Not Found</h1></body></html>"
        clientToProxySocket.end('HTTP/1.1 404\r\nContent-Type: text/html\r\n\r\n'+ response404);
        // clientToProxySocket.destroy();
    });

    clientToProxySocket.once('data', (data) =>{
       console.log("Found address : " + data.toString());
        let isTLSConnection = data.toString().indexOf('CONNECT') !== -1;
        let serverPort = 80;
        let serverAddress;
        if (isTLSConnection){
            console.log('Got CONNECT');
            serverPort = 443;
            serverAddress = data.toString().split(' ')[1].split(':')[0]
            // Do more for CONNECT banks like chase add www.chase.comhttp:443
            console.log('2. ' + serverAddress);
            if ( serverAddress.endsWith('http')){
                console.log('3. ' + serverAddress);
                var _serverAddress = serverAddress.split('http')[0];
                serverAddress = _serverAddress;
            }
            console.log('4. ' + serverAddress);
        } else {
            serverAddress = data.toString().split(' ')[1];
        }
        console.log("Server Address: " + serverAddress);
        if ( serverAddress.startsWith('http://')){
            console.log("removing http://")
            var q = url.parse(serverAddress, true);
            serverAddress = q.host;
        }
        
        let addressMatch = filterlist.filter(word => word.test(serverAddress));
        if ( addressMatch.length == 0){
            console.log("Didn't match: " + addressMatch);
            //clientToProxySocket.write('HTTP/1.1 404 \r\n\n');
            return clientToProxySocket.emit('error', new Error('404 Invalid url'));
        }else {     

        let proxyToServerSocket = net.createConnection({
            host: serverAddress,
            port: serverPort
        }, () => {
            console.log("Proxy to Server Setup");
                if ( isTLSConnection){
                    console.log("Sending Connect Response");
                    clientToProxySocket.write('HTTP/1.1 200 OK\r\n\n');
                } else {
                    proxyToServerSocket.write(data);
                }
                clientToProxySocket.pipe(proxyToServerSocket);
                proxyToServerSocket.pipe(clientToProxySocket);

                proxyToServerSocket.on('error', (err)=>{
                    console.log('Proxy to Server error');
                    console.log(err);
                });
                clientToProxySocket.on('error', (err)=>{
                    console.log('Client to proxy error');
                    console.log(err);
                });
            });
        }
    });
});


server.on('error', (err) => {
    console.log('Server Error');
    console.log(err);
});


server.on('close', () =>{
    console.log('Client Disconnected');
});

server.listen(8124, ()=> {
    console.log('server running at http://localhost:' + 8124);
});
