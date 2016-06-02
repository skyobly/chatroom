
var b = document.getElementById('join-room');
var c = document.getElementById('exit-room');

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia;

var gRecorder = null;
var audio = document.querySelector('audio');
var audio_container = document.getElementById('audio-container');
var door = false;
var ws = null;

var sendbtn = document.getElementById("send-btn");
var message = document.getElementById("msg-area");
sendbtn.onclick = function(){
    
    if(message.value.trim() != ""){
        ws.send(message.value);
    }
}

b.onclick = function() {
    if(!navigator.getUserMedia) {
        alert('抱歉您的设备无法语音聊天');
        return false;
    }

    SRecorder.get(function (rec) {
        gRecorder = rec;
    });

    ws = new WebSocket("wss://10.104.6.128:8888");
    ws.binaryType = "arraybuffer";

    ws.onopen = function() {
        console.log('握手成功');
        // var data = {};
        // data.user = a.value;
        // data.type = "init";
        // data.msg = "";
        // ws.send(JSON.stringify(data),"zheng");
    };

    ws.onmessage = function(e) {
        receive(e.data);
    };

    document.onkeydown = function(e) {
        if(e.keyCode === 65) {
            if(!door) {
                gRecorder.start();
                door = true;
            }
        }
    };

    document.onkeyup = function(e) {
        if(e.keyCode === 65) {
            if(door) {
                ws.send(gRecorder.getBlob());
                gRecorder.clear();
                gRecorder.stop();
                door = false;
            }
        }
    }
}

c.onclick = function() {
    if(ws) {
        ws.close();
    }
}

var SRecorder = function(stream) {
    config = {};

    config.sampleBits = config.smapleBits || 8;
    config.sampleRate = config.sampleRate || (44100 / 6);

    var context = new AudioContext();
    var audioInput = context.createMediaStreamSource(stream);
    var recorder = context.createScriptProcessor(4096, 1, 1);

    var audioData = {
        size: 0          //录音文件长度
        , buffer: []     //录音缓存
        , inputSampleRate: context.sampleRate    //输入采样率
        , inputSampleBits: 16       //输入采样数位 8, 16
        , outputSampleRate: config.sampleRate    //输出采样率
        , oututSampleBits: config.sampleBits       //输出采样数位 8, 16
        , clear: function() {
            this.buffer = [];
            this.size = 0;
        }
        , input: function (data) {
            this.buffer.push(new Float32Array(data));
            this.size += data.length;
        }
        , compress: function () { //合并压缩
            //合并
            var data = new Float32Array(this.size);
            var offset = 0;
            for (var i = 0; i < this.buffer.length; i++) {
                data.set(this.buffer[i], offset);
                offset += this.buffer[i].length;
            }
            //压缩
            var compression = parseInt(this.inputSampleRate / this.outputSampleRate);
            var length = data.length / compression;
            var result = new Float32Array(length);
            var index = 0, j = 0;
            while (index < length) {
                result[index] = data[j];
                j += compression;
                index++;
            }
            return result;
        }
        , encodeWAV: function () {
            var sampleRate = Math.min(this.inputSampleRate, this.outputSampleRate);
            var sampleBits = Math.min(this.inputSampleBits, this.oututSampleBits);
            var bytes = this.compress();
            var dataLength = bytes.length * (sampleBits / 8);
            var buffer = new ArrayBuffer(44 + dataLength);
            var data = new DataView(buffer);

            var channelCount = 1;//单声道
            var offset = 0;

            var writeString = function (str) {
                for (var i = 0; i < str.length; i++) {
                    data.setUint8(offset + i, str.charCodeAt(i));
                }
            };

            // 资源交换文件标识符 
            writeString('RIFF'); offset += 4;
            // 下个地址开始到文件尾总字节数,即文件大小-8 
            data.setUint32(offset, 36 + dataLength, true); offset += 4;
            // WAV文件标志
            writeString('WAVE'); offset += 4;
            // 波形格式标志 
            writeString('fmt '); offset += 4;
            // 过滤字节,一般为 0x10 = 16 
            data.setUint32(offset, 16, true); offset += 4;
            // 格式类别 (PCM形式采样数据) 
            data.setUint16(offset, 1, true); offset += 2;
            // 通道数 
            data.setUint16(offset, channelCount, true); offset += 2;
            // 采样率,每秒样本数,表示每个通道的播放速度 
            data.setUint32(offset, sampleRate, true); offset += 4;
            // 波形数据传输率 (每秒平均字节数) 单声道×每秒数据位数×每样本数据位/8 
            data.setUint32(offset, channelCount * sampleRate * (sampleBits / 8), true); offset += 4;
            // 快数据调整数 采样一次占用字节数 单声道×每样本的数据位数/8 
            data.setUint16(offset, channelCount * (sampleBits / 8), true); offset += 2;
            // 每样本数据位数 
            data.setUint16(offset, sampleBits, true); offset += 2;
            // 数据标识符 
            writeString('data'); offset += 4;
            // 采样数据总数,即数据总大小-44 
            data.setUint32(offset, dataLength, true); offset += 4;
            // 写入采样数据 
            if (sampleBits === 8) {
                for (var i = 0; i < bytes.length; i++, offset++) {
                    var s = Math.max(-1, Math.min(1, bytes[i]));
                    var val = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    val = parseInt(255 / (65535 / (val + 32768)));
                    data.setInt8(offset, val, true);
                }
            } else {
                for (var i = 0; i < bytes.length; i++, offset += 2) {
                    var s = Math.max(-1, Math.min(1, bytes[i]));
                    data.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                }
            }

            return buffer;
            //return new Blob([data], { type: 'audio/wav' });
        }
    };

    this.start = function () {
        audioInput.connect(recorder);
        recorder.connect(context.destination);
    }

    this.stop = function () {
        recorder.disconnect();
    }

    this.getBlob = function () {
        return audioData.encodeWAV();
    }

    this.clear = function() {
        audioData.clear();
    }

    recorder.onaudioprocess = function (e) {
        audioData.input(e.inputBuffer.getChannelData(0));
    }
};

SRecorder.get = function (callback) {
    if (callback) {
        if (navigator.getUserMedia) {
            navigator.getUserMedia(
                { audio: true },
                function (stream) {
                    var rec = new SRecorder(stream);
                    callback(rec);
                },
                function(err){
                  console.log(err)
                })
        }
    }
}

function receive(msg) {
    console.log(msg);
    console.log(msg instanceof ArrayBuffer);

    if(typeof msg === "string"){
        var data = JSON.parse(msg);
        if(data.type == "init"){
          text(data.user+" join the chatroom");
        }
        else{
          text(data.user+" : "+data.msg);
        }
    }
    else{
      var length = new Uint16Array(msg.slice(0,2))[0];
      console.log(length);
      var name = String.fromCharCode.apply(null,new Uint16Array(msg.slice(2,length*2+2)));
      console.log(name);
      audio(new Blob([msg.slice(length*2+2)], { type: 'audio/wav' }));
    }

    return ;
    

    function audio(audio_data){
        var audio_div = document.createElement("div");
        audio_div.className = "audio-div";
        var audio_ele = document.createElement("audio");
        audio_ele.src = window.URL.createObjectURL(audio_data);
        //audio_ele.controls = true;
        audio_div.appendChild(audio_ele);

        audio_ele.onloadedmetadata = function(){
            var time_ele = document.createTextNode(Math.ceil(audio_ele.duration)+'s');
            
            audio_div.appendChild(time_ele);
        }
            

        audio_container.appendChild(audio_div);
    }
    function text(text_data){
        var div = document.createElement("div");
        div.className = "text-div";
        
        var text_node = document.createTextNode(text_data);
        
        div.appendChild(text_node);
        audio_container.appendChild(div);
    }
        
}

document.onclick = function(e){
    var target = e.target;
    if (target.className == 'audio-div') {
        target.childNodes[0].play();
    };
}