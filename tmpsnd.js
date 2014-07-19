(function(w) {
  
  w.nTO = function(name) {
    if (typeof(name) !== 'string') return name;
    var subnames = name.split(".");
    return window[subnames[0]][subnames[1]];
  };
  
  
  // bind a to b
  function b(a, b) { a.bind(b); }
  // change that to true to log
  function log() { if (false) { console.log.apply(console, arguments); }}
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
    this.p = this.p.bind(this);
    b(this.p, this);
    b(this.t, this);
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
    o.frequency.value = f * (140 / 120); // fetch tempo here.
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
  SND.ReverbBuffer = function(ac, options) {
    var i,l;
    var opts = SND.extend({len: 2, decay: 5}, options)
    var len = ac.sampleRate * opts.l
    var buffer = ac.createBuffer(2, len, ac.sampleRate)
    var iL = buffer.getChannelData(0)
    var iR = buffer.getChannelData(1)
    var decay = opts.decay
    for(i=0,l=buffer.length;i<l;i++) {
      iL[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, opts.d);
      iR[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, opts.d);
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

  SND.DistCurve2 = function(ac, a) {
    var c  = new Float32Array(ac.sampleRate);
    var n_samples = c.length;
    for (var i = 0; i < c.length; i++) {
      var x = i * 2 / n_samples - 1;
      var y = x < 0 ? -Math.pow(Math.abs(x), a + 0.04) : Math.pow(x, a);
      c[i] = Math.tanh(y * 2);
    }
    return c;
  }

  SND.DistCurve3 = function(ac, a) {
    var c  = new Float32Array(ac.sampleRate);
    var n_samples = c.length;
    for (var i = 0; i < c.length; i++) {
      var x = i * 2 / n_samples - 1;
      var abx = Math.abs(x);
      var y;
      if(abx < a) y = abx;
      else if(abx > a) y = a + (abx - a) / (1 + Math.pow((abx - a) / (1 - a), 2));
      else if(abx > 1) y = abx;
      c[i] = (x < 0 ? -1 : 1) * y * (1 / ((a + 1) / 2));
    }
    return c;
  }

  SND.setSends = function(ac, sends, s, out) {
    if (typeof(s) == 'undefined') return;
    sends.forEach(function(send, i) {
      var amp = ac.createGain();
      amp.gain.value = s[i] || 0.0;
      out.c(amp);
      amp.c(send.destination);
    });
  };

  // In fractional beat
  SND.prototype.t = function() {
    return (this.c.currentTime - this.startTime) * (this.song.cfg.tempo / 60) * 4;
  }

  SND.prototype.p = function() {
    if (this.playing == true) return;
    if (!this.startTime) this.startTime = this.c.currentTime;
    var stepTime = 15 / this.song.cfg.tempo,
        patternTime = stepTime * 64,
        currentPos = 0,
        currentTime = this.c.currentTime;
        
    this.playing = true;
    
    var patternScheduler = (function() {
      if (this.playing == false) return;
      if (currentTime - this.c.currentTime < (patternTime / 4)) {
        SND.st = [];
        for(i=0;i<64;i++) { SND.st[i] = currentTime + (stepTime * i); }
        var cP = this.song.playlist[currentPos];
        log(cP);
        for (var instrId in cP) {
          if (cP.hasOwnProperty(instrId)) {
            log("scheduling", cP[instrId], "for", instrId)
            var data = this.song.patterns[cP[instrId]];
            this.instruments[instrId].pp(SND.st, stepTime, data); 
          }          
        }
        currentPos = (currentPos + 1) % this.song.playlist.length;
        currentTime += patternTime;
      }      
      setTimeout(patternScheduler, 40);
    }).bind(this);
    patternScheduler();
  };
  SND.prototype.s = function() {
    this.playing = false;
  }
  // SEND EFFECTS
  SND.DEL = function(ac, cfg) {
    var opts = SND.extend({t: 0.2, fb: 0.4, m: 0.6, f: 800, q: 2}, cfg)
    this.ac = ac;
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
    this.c= function(node) {
      this.mix.c(node);
    };
    b(this.c, this);
    this.destination = this.delay;
    return this;
  };
  
  SND.REV = function(ac, cfg) {
    var opts = SND.extend({l: 2, d: 5, m: 0.8}, cfg);
    this.ac = ac;
    var cnv = ac.createConvolver();
    this.mix = ac.createGain();
    cnv.buffer = SND.ReverbBuffer(ac, {l: opts.l, d: opts.d});
    this.mix.gain.value = opts.m;
    cnv.c(this.mix);    
    this.c= function(node) {
      this.mix.c(node);
    };
    this.destination = cnv;
    return this;
  }
  
  SND.DELREV = function(ac, cfg) {
    var opts = SND.extend({t:0.2, fb: 0.4, m: 1, f: 800, q: 2, l: 6, d: 5}, cfg);
    this.del = new SND.DEL(ac, {t: opts.t, fb: opts.fb, m: opts.m, f: opts.f, q: opts.q});
    this.rev = new SND.REV(ac, {l: opts.l, d: opts.d, m: opts.m});
    this.del.c(this.rev.destination);
    this.destination = this.del.destination;
    this.c= function(node) {
      this.rev.c(node);
    };
    return this;
  }

  SND.DIST = function(ac, cfg) {
    var opts = SND.extend({a: 50, m: 1}, cfg);
    this.ac = ac;
    var ws = ac.createWaveShaper();
    this.mix = ac.createGain();
    ws.curve = SND.DistCurve(ac, opts.a);
    this.mix.gain.value = opts.m;
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
    b(that.play, that);
    return that;
  }
  SND.Drum = function(ac, sends, options) {
    var that = new SND.SProto(ac, sends, options, {sw: 0.05, d: 0.1, st: 200, en: 50, v: 0.8, s: []});
    that.play = function(t, stepTime, data) {
      var opts = SND.extend(that.options, data[1]);
      var osc = that.ac.createOscillator();
      osc.type = opts.t || "sine";
      var click = that.ac.createOscillator();
      click.type = "square";
      SND.AD(osc.frequency, opts.en, opts.st, t, 0, opts.sw);
      click.frequency.value = 40;
      var amp = SND.DCA(that.ac, osc, opts.v, t, 0.005, opts.d);
      var ampclick = ac.createGain();
      click.c(ampclick);
      SND.D(ampclick.gain, t, 0.5, 0.0001);
      amp.c(that.ac.destination);
      ampclick.c(that.ac.destination);
      SND.setSends(that.ac, sends, opts.s, amp);
      osc.start(t);osc.stop(t + 0.001 + opts.d);
      click.start(t);click.stop(t + 0.009);
    }
    b(that.play, that);
    return that;
  };

  SND.Snare = function(ac, sends, options) {
    var that = new SND.SProto(ac, sends, options, {sw: 0.05, d:0.1, st:200, en:50,v:0.5, s:[]});
    // snare: drum with a higher fundamental + noise
    options.f = 286;
    that.d = new SND.Drum(ac, sends, options);
    // less tail
    options.ft = "lowpass"
    options.f = 3000;
    options.v *= 0.15;
    that.n = new SND.Noise(ac, sends, options);
    that.play =  function(t, stepTime, data) {
      that.d.play(t, stepTime, data);
      that.n.play(t, stepTime, data);
    };
    b(that.play, that);
    return that;
  };
  SND.Synth = function(ac, sends, options) {
    var that = new SND.SProto(ac, sends, options, {t: 'sawtooth', q: 10, f: 200, fm: 1000, d: 1.0, v: 0.5, s: []});    
    that.play = function(t, stepTime, data) {
      var note = data[0];
      if (note.length) {  // chord!
        note.forEach(function(n) {
          that.play(t, stepTime, [n, data[1]]);
        }, that);
        return;
      }
      var opts = SND.extend(that.options, data[1]);
      var osc = that.ac.createOscillator();
      var flt = that.ac.createBiquadFilter();
      flt.Q.value = opts.q;
      osc.frequency.value = n2f(note);
      osc.type = opts.t;
      len = stepTime * (data[1].l || 1);
      osc.c(flt);
      var amp = SND.DCA(this.ac, flt, opts.v, t, 0.01, len);
      SND.setSends(that.ac, sends, opts.s, amp);
      amp.c(ac.destination);
      SND.AD(flt.frequency, opts.f, opts.f + opts.fm, t, 0.01, len * opts.d);
      osc.start(t);osc.stop(t + len);
    }
    b(that.play, that);
    return that;
  }

  SND.Sub = function(ac, sends, options) {
    var that = new SND.SProto(ac, sends, options, {t: 'sine', v:0.5});
    that.play = function(t, stepTime, data) {
      var note = data[0];
      if (note.length) {  // chord!
        note.forEach(function(n) {
          that.play(t, stepTime, [n, data[1]]);
        }, that);
        return;
      }
      var opts = SND.extend(that.options, data[1]);

      var osc = that.ac.createOscillator();
      var f = n2f(note);
      osc.frequency.value = f;
      osc.type = opts.t;
      len = stepTime * (data[1].l || 1);
      var amp = SND.DCA(this.ac, osc, opts.v, t, 0.001, len * 4);
      // portamento/bass drop
      if (opts.dn) {
        SND.AD(osc.frequency, n2f(opts.dn), f, t, 0, len);
      }
      amp.c(ac.destination);
      SND.setSends(that.ac, sends, opts.s, amp);
      osc.start(t);osc.stop(t + len);
    }
    b(that.play, that);
    return that;
  }

  SND.Reese = function(ac, sends, options) {
    var that = new SND.SProto(ac, sends, options, {t: 'sawtooth', v:0.5});
    that.play = function(t, stepTime, data) {
      var note = data[0];
      if (note.length) {  // chord!
        note.forEach(function(n) {
          that.play(t, stepTime, [n, data[1]]);
        }, that);
        return;
      }
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
    b(that.play, that);
    return that;
  }

  SND.Organ = function(ac, sends, options) {
    var that = new SND.SProto(ac, sends, options, {t: 'sine', v:0.5});
    that.play = function(t, stepTime, data) {
      var note = data[0];
      var opts = SND.extend(that.options, data[1]);
      var len = stepTime * (data[1].l || 1);

      var amp = ac.createGain();

      var harmonics = [-1200, 700,   0, 50, 1200, 1900, 2300, 1900, 2200];
      var gain =      [1.0,   1.5, 1.0, 0.0, 0.0,  0.0,  0.0,  0.0,  0.0];
      for (var i = 0; i < harmonics.length; i++) {
        var o = ac.createOscillator();
        var g = ac.createGain();
        o.frequency.value = n2f(note);
        o.detune.value = harmonics[i];

        o.c(g);
        g.gain.value = gain[i];
        g.c(amp);
        o.start(t);o.stop(t+len * 8);
      }

      SND.D(amp.gain, t, 0.15, len / 2);
      SND.setSends(that.ac, sends, opts.s, amp);
      // amp.connect(ac.destination);
    }
    b(that.play, that);
    return that;
  }
})(window);
