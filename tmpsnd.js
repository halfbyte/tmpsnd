(function(w) {
  
  w.nTO = function(name) {
    if (typeof(name) !== 'string') return name;
    var subnames = name.split(".");
    return window[subnames[0]][subnames[1]];
  };
  
  // change that to true to log
  function log() { if (false) { console.log.apply(console, arguments); }}
  function editing() { return false; }
  function n2f(n) {
    return Math.pow(2, (n - 69) / 12) * 440;
  }

  AudioNode.prototype.c = AudioNode.prototype.connect;

  w.SND = function(song) {
    var t = this;
    t.song = song;
    if (w.webkitAudioContext) {
      t.c = new webkitAudioContext();
    } else {
      t.c = new AudioContext();
    }
    t.initSends()
    t.initInstruments()
    log('SND.constr', this);
    t.playing = false;
    return t;
  };

  SND.prototype.initSends = function() {
    var _sends = [];
    this.song.sends.forEach(function(send, index) {
      sendObj = new (nTO(send[0]))(this.c, send[1]);
      log(sendObj);
      sendObj.c(this.c.destination);
      _sends.push(sendObj);
    }, this);
    this.sends = _sends;
  }
  SND.prototype.initInstruments = function() {
    log(this, this.c)
    var t = this;
    var _instruments = [];
    this.song.instruments.forEach(function(instr, index) {
      instrObj = new (nTO(instr[0]))(this.c, this.sends, instr[1]);
      _instruments.push(instrObj);
    }, this);
    this.instruments = _instruments;
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
  SND.DCA = function(ac, i, v, t, a, d) {
    var g = ac.createGain();
    i.c(g);
    SND.AD(g.gain, 0, v, t, a, d);
    return g;
  };
  SND.LFO = function(ac, t, p, g, f)  {
    var o = ac.createOscillator();
    o.frequency.value = f * (125 / 120); // fetch tempo here.
    var s = ac.createGain();
    s.gain.value = g;
    o.c(s);
    s.c(p);
    o.start(t); o.stop(t + 10); // long tail
  }
  SND.NoiseBuffer = function(ac) {
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
  SND.ReverbBuffer = function(ac, opts) {
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

  SND.DistCurve = function(ac, k) {
    var c = new Float32Array(ac.sampleRate);
    var deg = Math.PI / 180;
    for (var i = 0; i < c.length; i++) {
      var x = i * 2 / c.length - 1;
      c[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return c;
  }
  SND.setSends = function(ac, sends, s, out) {
    if (s) {
    sends.forEach(function(send, i) {
      var amp = ac.createGain();
      amp.gain.value = s[i] || 0.0;
      out.c(amp);
      amp.c(send.destination);
    });
    }
  };

  // In fractional beat
  SND.prototype.t = function() {
    return (this.c.currentTime - this.startTime) * (125/ 60) * 4;
  }

  SND.prototype.p = function() {
    if (this.playing == true) return;
    if (!this.startTime) this.startTime = this.c.currentTime;
    var stepTime = 15 / 125,
        patternTime = stepTime * 64,
        currentTime = this.c.currentTime;

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
      if (currentTime - this.c.currentTime < (patternTime / 4)) {
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
  SND.DEL = function(ac) {
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
  
  SND.REV = function(ac) {
    var opts = {d: 0.05, m: 1};
    var cnv = ac.createConvolver();
    this.mix = ac.createGain();
    cnv.buffer = SND.ReverbBuffer(ac, {l: 2, d: opts.d});
    this.mix.gain.value = opts.m;
    cnv.c(this.mix);    
    this.c= function(node) {
      this.mix.c(node);
    };
    this.destination = cnv;
    return this;
  }

  SND.DIST = function(ac) {
    var ws = ac.createWaveShaper();
    this.mix = ac.createGain();
    ws.curve = SND.DistCurve(ac, 50);
    this.mix.gain.value = 0.5;
    ws.c(this.mix);
    this.c= function(node) {
      this.mix.c(node);
    };
    this.destination = ws;
    return this;
  }
  
  // INSTRUMENTS
  
  SND.SProto = function(ac, sends, options, defaults) {
    this.ac = ac;
    this.sends = sends;
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
  SND.Noise = function(ac, sends, options) {
    log("INIT NOISE", ac, sends, options)
    var that = new SND.SProto(ac, sends, options, {q: 10, d: 0.05, ft: 'highpass', f: 8000, v: 0.1, s: []});
    var noise = SND.NoiseBuffer(ac);
    var opts = that.options;
    that.play = function(t, stepTime, data) {
      var opts = SND.extend(that.options, data[1]);
      var smp = ac.createBufferSource();
      var flt = ac.createBiquadFilter();
      smp.c(flt);
      var amp = SND.DCA(that.ac, flt, opts.v, t, 0.001, opts.d);
      flt.frequency.value = opts.f;
      flt.type = opts.ft;
      flt.Q.value = opts.q;
      smp.buffer = noise;
      smp.c(amp);
      SND.setSends(that.ac, sends, opts.s, amp);
      amp.c(that.ac.destination);      
      smp.start(t);smp.stop(t + 0.001 + opts.d);
    }
    return that;
  }
  SND.Drum = function(ac, sends, options) {
    var that = new SND.SProto(ac, sends, options, {sw: 0.05, k: 0.07, st: 200, en: 50, v: 0.8, s: []});
    that.play = function(t, stepTime, data) {
      var opts = SND.extend(that.options, data[1]);
      var osc = that.ac.createOscillator();
      osc.type = opts.t || "sine";
      var click = that.ac.createOscillator();
      click.type = "square";
      click.frequency.value = 40;

      // SND.AD(osc.frequency, opts.en, opts.st, t, 0, opts.k * 8);
      osc.frequency.value = opts.st;
      osc.frequency.setValueAtTime(opts.st, t);
      osc.frequency.setTargetAtTime(opts.en, t+0.001, opts.k)

      var amp = ac.createGain();
      osc.c(amp);
      SND.D(amp.gain, t, opts.v, opts.k);
      amp.c(that.ac.destination);

      var ampclick = ac.createGain();
      click.c(ampclick);
      SND.D(ampclick.gain, t, opts.v, 0.005);
      ampclick.c(that.ac.destination);

      SND.setSends(that.ac, sends, opts.s, amp);

      osc.start(t);osc.stop(t + 0.001 + opts.d * 4);
      click.start(t);click.stop(t + 0.009);
    }
    return that;
  };

  SND.Snare = function(ac, sends, options) {
    var that = new SND.SProto(ac, sends, options, {type: 'triangle', f: 3000, sw: 0.05, d:0.1,v:1.0, k:0.01, s:[]});

    var noise = SND.NoiseBuffer(ac);

    that.play =  function(t, stepTime, data) {
      var opts = SND.extend(that.options, data[1]);
      var f = [111 + 175, 111 + 224];
      var o = [];

      // filter for noise and osc
      var fl = ac.createBiquadFilter();
      // fl.type = "lowpass" // default
      fl.frequency.value = opts.f;

      //.amp for oscillator
      var amposc = ac.createGain();
      SND.D(amposc.gain, t, opts.v, opts.k);

      // two osc
      f.forEach(function(e, i) {
        o[i] = ac.createOscillator();
        o[i].type = opts.type
        o[i].frequency.value = f[i];
        o[i].c(amposc);
        o[i].start(t); o[i].stop(t + opts.d * 4);
      })

      // noise
      var smp = ac.createBufferSource();
      smp.buffer = noise;
      var ampnoise = ac.createGain();
      smp.c(ampnoise);
      SND.D(ampnoise.gain, t, opts.v * 0.4, opts.k * 3);
      smp.start(t);smp.stop(t + 0.001 + opts.d);

      ampnoise.c(fl);
      amposc.c(fl);

      SND.setSends(that.ac, sends, opts.s, fl);
      fl.c(that.ac.destination);
    };
    return that;
  };
  SND.Synth = function(ac, sends, options) {
    var that = new SND.SProto(ac, sends, options, {t: 'sawtooth', q: 10, f: 200, fm: 1000, d: 1.0, v: 0.5, s: []});
    that.play = function(t, stepTime, data) {
      var opts = SND.extend(that.options, data[1]);
      var osc = that.ac.createOscillator();
      var flt = that.ac.createBiquadFilter();
      flt.Q.value = opts.q;
      osc.frequency.value = n2f(data[0]);
      osc.type = opts.t;
      len = stepTime * (data[1].l || 1);
      osc.c(flt);
      var amp = SND.DCA(this.ac, flt, opts.v, t, 0.01, len);
      SND.setSends(that.ac, sends, opts.s, amp);
      amp.c(ac.destination);
      SND.AD(flt.frequency, opts.f, opts.f + opts.fm, t, 0.01, len * opts.d);
      osc.start(t);osc.stop(t + len);
    }
    return that;
  }

  SND.Sub = function(ac, sends, options) {
    var that = new SND.SProto(ac, sends, options, {t: 'sine', v:0.5});
    that.play = function(t, stepTime, data) {
      var opts = SND.extend(that.options, data[1]);
      var osc = that.ac.createOscillator();
      osc.frequency.value = n2f(data[0]);
      osc.type = opts.t;
      len = stepTime * data[1].l;
      // len = stepTime * (data[1].l || 1);
      var amp = SND.DCA(ac, osc, opts.v, t, 0.05, len);
      amp.c(ac.destination);
      osc.start(t - 0.001);osc.stop(t + len);
    }
    return that;
  }

  SND.Reese = function(ac, sends, options) {
    var that = new SND.SProto(ac, sends, options, {t: 'sawtooth', v:0.5});
    that.play = function(t, stepTime, data) {
      var note = data[0];
      var opts = SND.extend(that.options, data[1]);
      var len = stepTime * (data[1].l || 1);

      var flt = ac.createBiquadFilter();
      SND.LFO(ac, t, flt.frequency, opts.co, opts.lfo)
      amp = SND.DCA(this.ac, flt, opts.v, t, 0, len);
      for (var i = 0; i < 2; i++) {
        o = that.ac.createOscillator();
        if (opts.dn) {
          SND.AD(o.frequency, n2f(opts.dn), d, t, 0, len);
        }
        o.frequency.value = n2f(note);
        o.type = opts.t;
        o.detune.value = i * 50;
        o.c(flt);
        o.start(t);o.stop(t+len);
      }
      amp.c(ac.destination)
      SND.setSends(ac, sends, opts.s, amp);
    }
    return that;
  }

  SND.Glitch = function(ac, sends, options) {
    var that = new SND.SProto(ac, sends, options);
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
      SND.setSends(ac, sends, [0.3, 0.8], sink);
    }
    return that;
  }
})(window);

snd = new SND(SONG);
snd.p();

