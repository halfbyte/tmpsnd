  // change that to true to log
  function log() { if (false) { console.log.apply(console, arguments); }}
  function editing() { return false; }
  function n2f(n) {
    return Math.pow(2, (n - 69) / 12) * 440;
  }

  AudioNode.prototype.c = AudioNode.prototype.connect;
  // this is ONE byte.
  AudioContext.prototype.c = AudioContext.prototype.createOscillator;

  ac = new AudioContext();

  function SND(song) {
    var t = this;
    t.song = song;
    t.initSends()
    t.initInstruments()
    log('SND.constr', this);
    t.playing = false;
    return t;
  };

  SND.prototype.initSends = function() {
    // GLOBAL !
    _sends = [];
    sends.forEach(function(send, index) {
      var o = new send[0](send[1]);
      _sends.push(o);
      o.c(ac.destination);
    }, this);
  }
  SND.prototype.initInstruments = function() {
    this.instruments = [];
    instruments.forEach(function(instr, index) {
      this.instruments.push(new instr[0](instr[1]));
    }, this);
  };
  SND.extend = function(o, o2) {
    var o1 = {};
    o2 = o2 || {};
    for (var attrname in o) { o1[attrname] = o[attrname]; }
    for (var attrname2 in o2) { o1[attrname2] = o2[attrname2]; }
    return o1;
  }
  SND.AD = function(p/*aram*/, l/*start*/, u/*end*/, t/*startTime*/, a/*attack*/, d/*decay*/) {
    p.setValueAtTime(l, t);
    p.linearRampToValueAtTime(u, t + a);
    // XXX change that to setTargetAtTime
    p.linearRampToValueAtTime(l, t + d);
  };
  SND.D = function(p, t, v, k) {
    p.value = v;
    p.setValueAtTime(v, t);
    p.setTargetAtTime(0, t, k);
  }
  SND.DCA = function(i, v, t, a, d) {
    var g = ac.createGain();
    i.c(g);
    SND.AD(g.gain, 0, v, t, a, d);
    return g;
  };
  SND.NoiseBuffer = function() {
    var i,l;
    if (!SND._noisebuffer) {
      SND._noisebuffer = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate / 2);
      var cdata = SND._noisebuffer.getChannelData(0);
      for(i=0,l=cdata.length;i<l;i++) { 
        cdata[i] = Math.random() * 2.0 - 1.0; 
      }
    }
    return SND._noisebuffer;
  }
  SND.ReverbBuffer = function(opts) {
    var i,l;
    var len = ac.sampleRate * opts.l
    var buffer = ac.createBuffer(2, len, ac.sampleRate)
    for(i=0,l=buffer.length;i<l;i++) {
      var s =  Math.pow(1 - i / len, opts.d);
      buffer.getChannelData(0)[i] = (Math.random() * 2 - 1)*2;
      buffer.getChannelData(1)[i] = (Math.random() * 2 - 1)*2;
    }
    return buffer;
  }

  SND.DistCurve = function(k) {
    var c = new Float32Array(ac.sampleRate);
    var deg = Math.PI / 180;
    for (var i = 0; i < c.length; i++) {
      var x = i * 2 / c.length - 1;
      c[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return c;
  }
  SND.setSends = function(s, out) {
    if (s) {
    _sends.forEach(function(send, i) {
      var amp = ac.createGain();
      amp.gain.value = s[i] || 0.0;
      out.c(amp);
      amp.c(send.destination);
    });
    }
  };

  // In fractional beat
  SND.prototype.t = function() {
    return (ac.currentTime - this.startTime) * (125/ 60) * 4;
  }

  SND.prototype.p = function() {
    if (this.playing == true) return;
    if (!this.startTime) this.startTime = ac.currentTime;
    var stepTime = 15 / 125,
        patternTime = stepTime * 64,
        currentTime = ac.currentTime;

    this.currentPos = 0;
    if (editing()) {
      // the patter to loop, or -1 to just play the track
      this.loop = this.loop != undefined ? this.loop : -1;
      // start at the loop if specified, beginning otherwise
      this.currentPos = this.loop != -1 ? this.loop : 0;
    }

    this.playing = true;

    var patternScheduler = (function() {
      if (this.playing == false) return;
      if (currentTime - ac.currentTime < (patternTime / 4)) {
        SND.st = [];
        for(i=0;i<64;i++) { SND.st[i] = currentTime + (stepTime * i); }
        var cP = this.song.playlist[this.currentPos];
        log(cP);
        for (var instrId in cP) {
          if (cP.hasOwnProperty(instrId)) {
            log("scheduling", cP[instrId], "for", instrId)
            var data = this.song.patterns[cP[instrId]];
            this.instruments[instrId].pp(SND.st, stepTime, data); 
          }
        }
        if (editing()) {
          if (this.loop == -1) {
            this.currentPos = (this.currentPos + 1) % this.song.playlist.length;
          } else {
            this.currentPos = this.loop;
          }
        } else{
          this.currentPos = (this.currentPos + 1) % this.song.playlist.length;
        }
        currentTime += patternTime;
      }
      setTimeout(patternScheduler, 1000);
    }).bind(this);
    patternScheduler();
  };
  SND.prototype.s = function() {
    this.playing = false;
  }
  // SEND EFFECTS
  SND.DEL = function() {
    var opts = {t: 0.36, fb: 0.4, m: 0.6, f: 800, q: 2};
    this.delay = ac.createDelay();
    this.delay.delayTime.value = opts.t;
    var fb = ac.createGain();
    var flt = ac.createBiquadFilter();
    flt.type = 'highpass';
    flt.frequency.value = opts.f;
    flt.Q.value = opts.q;
    fb.gain.value = opts.fb;
    this.mix = ac.createGain();
    this.mix.gain.value = opts.m;
    this.delay.c(this.mix);
    this.delay.c(flt);
    flt.c(fb);
    fb.c(this.delay);
    this.c = function(node) {
      this.mix.c(node);
    };
    this.destination = this.delay;
    return this;
  };
  
  SND.REV = function() {
    var opts = {d: 0.05, m: 1};
    var cnv = ac.createConvolver();
    this.mix = ac.createGain();
    cnv.buffer = SND.ReverbBuffer({l: 2, d: opts.d});
    this.mix.gain.value = opts.m;
    cnv.c(this.mix);    
    this.c= function(node) {
      this.mix.c(node);
    };
    this.destination = cnv;
    return this;
  }

  SND.DIST = function() {
    var ws = ac.createWaveShaper();
    this.mix = ac.createGain();
    ws.curve = SND.DistCurve(50);
    this.mix.gain.value = 0.5;
    ws.c(this.mix);
    this.c= function(node) {
      this.mix.c(node);
    };
    this.destination = ws;
    return this;
  }
  
  // INSTRUMENTS
  
  SND.SProto = function(options, defaults) {
    this.ac = ac;
    this.options = SND.extend(defaults, options);
    return this;
  };
  SND.SProto.prototype.pp = function(times, stepTime, data) {
    times.forEach(function(t, i) {
      note = data[i];
      if (typeof(note) !== 'object') {
        note = [note, {}]
      }
      if (note[0] != 0) {
        this.play(t, stepTime, note);
      }
    }, this);
  };
  SND.Noise = function() {
    var that = new SND.SProto();
    var noise = SND.NoiseBuffer();
    that.play = function(t) {
      var smp = ac.createBufferSource();
      var flt = ac.createBiquadFilter();
      smp.c(flt);
      var amp = SND.DCA(flt, 0.1, t, 0.001, 0.06);
      flt.frequency.value = 8000;
      flt.type = "highpass";
      flt.Q.value = 8;
      smp.buffer = noise;
      smp.c(amp);
      SND.setSends([0.3], amp);
      amp.c(ac.destination);
      smp.start(t);smp.stop(t + 0.06);
    }
    return that;
  }
  SND.Drum = function(options) {
    var that = new SND.SProto(options);
    that.play = function(t) {
      var osc = ac.c();
      var click = ac.c();
      click.type = "square";
      click.frequency.value = 40;

      // SND.AD(osc.frequency, opts.en, opts.st, t, 0, opts.k * 8);
      osc.frequency.value = 90;
      osc.frequency.setValueAtTime(90, t);
      osc.frequency.setTargetAtTime(50, t+0.001, 0.03)

      function d(o, e){
        var amp = ac.createGain();
        o.c(amp);
        SND.D(amp.gain, t, 1.0, e);
        amp.c(ac.destination);
      }

      d(osc, 0.03)
      d(click, 0.005)

      osc.start(t);osc.stop(t + 0.2);
      click.start(t);click.stop(t + 0.009);
    }
    return that;
  };

  SND.Snare = function(options) {
    var that = new SND.SProto(options);
    var noise = SND.NoiseBuffer();

    that.play =  function(t) {
      var f = [111 + 175, 111 + 224];
      var o = [];

      // filter for noise and osc
      var fl = ac.createBiquadFilter();
      // fl.type = "lowpass" // default
      fl.frequency.value = 3000;

      // amp for oscillator
      var amposc = ac.createGain();
      SND.D(amposc.gain, t, 0.4, 0.015);

      // two osc
      f.forEach(function(e, i) {
        o[i] = ac.c();
        o[i].type = "triangle";
        o[i].frequency.value = f[i];
        o[i].c(amposc);
        o[i].start(t); o[i].stop(t + 0.4);
      })

      // noise
      var smp = ac.createBufferSource();
      smp.buffer = noise;
      var ampnoise = ac.createGain();
      smp.c(ampnoise);
      SND.D(ampnoise.gain, t, 0.24, 0.045);
      smp.start(t);smp.stop(t + 0.1);

      ampnoise.c(fl);
      amposc.c(fl);

      SND.setSends([0.3, 0.2], fl);
      fl.c(ac.destination);
    };
    return that;
  };
  SND.Synth = function() {
    var that = new SND.SProto();
    that.play = function(t, stepTime, data) {
      var osc = ac.c();
      var flt = ac.createBiquadFilter();
      flt.Q.value = 2;
      osc.frequency.value = n2f(data[0]);
      osc.type = "square"
      len = stepTime * (data[1].l || 1);
      osc.c(flt);
      var amp = SND.DCA(flt, data[1].v || 0.1, t, 0.01, len);
      SND.setSends([0.5, 0.6], amp);
      amp.c(ac.destination);
      SND.AD(flt.frequency, 200, 2000, t, 0.01, len / 2);
      osc.start(t);osc.stop(t + len);
    }
    return that;
  }

  SND.Sub = function(options) {
    var that = new SND.SProto(options);
    that.play = function(t, stepTime, data) {
      var osc = ac.c();
      osc.frequency.value = n2f(data[0]);
      len = stepTime * data[1].l;
      // len = stepTime * (data[1].l || 1);
      var amp = SND.DCA(osc, 0.6, t, 0.05, len);
      amp.c(ac.destination);
      osc.start(t);osc.stop(t + len);
    }
    return that;
  }

  SND.Reese = function() {
    var that = new SND.SProto();
    that.play = function(t, stepTime, data) {
      var note = data[0];
      var len = stepTime * data[1].l;

      var flt = ac.createBiquadFilter();
      var o = ac.c();
      o.frequency.value = data[1].f * (125 / 120); // fetch tempo here.
      var s = ac.createGain();
      s.gain.value = 8000;
      o.c(s);
      s.c(flt.frequency);
      o.start(t); o.stop(t + 10); // long tail
      amp = SND.DCA(flt, data[1].v, t, 0, len);
      for (var i = 0; i < 2; i++) {
        o = ac.c();
        o.frequency.value = n2f(note);
        o.type = "square";
        o.detune.value = i * 50;
        o.c(flt);
        o.start(t);o.stop(t+len);
      }
      amp.c(ac.destination)
      SND.setSends([0,0.4,1], amp);
    }
    return that;
  }

  SND.Glitch = function(options) {
    var that = new SND.SProto(options);
    var noise = SND.NoiseBuffer();
    that.play = function(t, stepTime, data) {
      var len = 48 * stepTime;
      var source = ac.createBufferSource();
      var end = t + len;
      var sources = [];
      var i = 0;
      var sink = ac.createGain();
      sink.gain.value = 0.05;
      while (t < end) {
        sources[i] = ac.createBufferSource();
        sources[i].buffer = noise;
        sources[i].loop = true;
        sources[i].loopStart = 0;
        sources[i].loopEnd = Math.random() * 0.05;
        sources[i].start(t);
        t += Math.random() * 0.5;
        t = Math.min(t, end);
        sources[i].stop(t);
        sources[i].c(sink);
        i++;
      }
      sink.c(ac.destination);
      SND.setSends([0.3, 0.8], sink);
    }
    return that;
  }

