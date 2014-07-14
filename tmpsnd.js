(function(w) {
  // change that to true to log
  function log(msg) { if (false) { console.log(msg); }}
  w.SND = function(song) {
    var t = this;
    t.song = song;
    if (w.webkitAudioContext) {
      t.c = new webkitAudioContext();
    } else {
      t.c = new AudioContext();
    }
    
    t.sends = [];
    t.instruments = [];
    song.sends.forEach(function(send, index) {
      sendObj = new send[0](t.c, send[1]);
      sendObj.connect(t.c.destination);
      t.sends.push(sendObj);
    });
    song.instruments.forEach(function(instr, index) {
      instrObj = new instr[0](t.c, t.sends, instr[1]);
      t.instruments.push(instrObj);
    });
    
    log('SND.constr', this);
    this.p = this.p.bind(this);

    return t;
  };
  SND.extend = function(o, o2) {
    var o1 = {};
    for (var attrname in o) { o1[attrname] = o[attrname]; }
    for (var attrname2 in o2) { o1[attrname2] = o2[attrname2]; }
    return o1;
  }
  SND.n2f = function(n) {
    return Math.pow(2, (n - 69) / 12) * 440;
  }
  SND.AD = function(p/*aram*/, l/*start*/, u/*end*/, t/*startTime*/, a/*attack*/, d/*decay*/) {
    p.setValueAtTime(l, t);
    p.linearRampToValueAtTime(u, t + a);
    // XXX change that to setTargetAtTime
    p.linearRampToValueAtTime(l, t + d);
  };
  SND.DCA = function(ac, i, v, t, a, d) {
    var g = ac.createGain();
    i.connect(g);
    SND.AD(g.gain, 0, v, t, a, d);
    return g;
  };
  SND.NoiseBuffer = function(ac) {
    var i,l;
    if (typeof(SND._noisebuffer) == 'undefined') {
      SND._noisebuffer = ac.createBuffer(1, ac.sampleRate * 0.5, 22050);
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

  
  
  SND.sends = function(ac, sends, s, out) {
    sends.forEach(function(send, i) {
      var amp = ac.createGain();
      amp.gain.value = s[i] || 0.0;
      out.connect(amp);
      amp.connect(send.destination);
    });
  };
  SND.prototype.p = function() {
    var stepTime = 15 / this.song.cfg.tempo;
    var patternTime = stepTime * 64;
    var currentPos = 0;
    var currentTime = this.c.currentTime;
    var patternScheduler = function() {
      if (currentTime - this.c.currentTime < (patternTime / 4)) {
        var stepTimes = [];
        for(i=0;i<64;i++) { stepTimes[i] = currentTime + (stepTime * i); }
        var cP = this.song.playlist[currentPos];
        log(cP);
        for (var instrId in cP) {
          if (cP.hasOwnProperty(instrId)) {
            log("scheduling", cP[instrId], "for", instrId)
            this.instruments[instrId].pp(stepTimes, stepTime, this.song.patterns[cP[instrId]]); 
          }
        }
        currentPos = (currentPos + 1) % this.song.playlist.length;
        currentTime += patternTime;
      }      
      setTimeout(patternScheduler, 40);
    };
    patternScheduler = patternScheduler.bind(this);
    patternScheduler();

  };
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
    this.delay.connect(this.mix);
    this.delay.connect(flt);
    flt.connect(fb);
    fb.connect(this.delay);
    this.connect = function(node) {
      this.mix.connect(node);
    };
    this.connect = this.connect.bind(this);
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
    cnv.connect(this.mix);    
    this.connect = function(node) {
      this.mix.connect(node);
    };
    this.connect = this.connect.bind(this);
    this.destination = cnv;
    return this;
  }
  
  SND.DELREV = function(ac, cfg) {
    var opts = SND.extend({t:0.2, fb: 0.4, m: 1, f: 800, q: 2, l: 6, d: 5}, cfg);
    this.del = new SND.DEL(ac, {t: opts.t, fb: opts.fb, m: opts.m, f: opts.f, q: opts.q});
    this.rev = new SND.REV(ac, {l: opts.l, d: opts.d, m: opts.m});
    this.del.connect(this.rev.destination);
    this.destination = this.del.destination;
    this.connect = function(node) {
      this.rev.connect(node);
    };
    this.connect = this.connect.bind(this);
    return this;
  }

  SND.DIST = function(ac, cfg) {
    var opts = SND.extend({a: 50}, cfg);
    this.ac = ac;
    var ws = ac.createWaveShaper();
    this.mix = ac.createGain();
    ws.buffer = S.DistCurve(ac, opts.a);
    this.mix.gain.value = opts.m;
    ws.connect(this.mix);
    this.connect = function(node) {
      this.mix.connect(node);
    };
    this.connect = this.connect.bind(this);
    this.destination = ws;
  }
  
  // INSTRUMENTS
  
  SND.SProto = function(ac, sends, options, defaults) {
    this.ac = ac;
    this.sends = sends;
    this.options = SND.extend(defaults, options);
    this.pp = this.pp.bind(this);
    return this;
  };
  SND.SProto.prototype.pp = function(times, stepTime, data) {
    times.forEach(function(t, i) {
      if (data[i] != 0) {
        this.play(t, stepTime, data[i]);
      }
    }, this);
  };
  SND.Noise = function(ac, sends, options) {
    var that = new SND.SProto(ac, sends, options, {q: 10, d: 0.05, ft: 'highpass', f: 8000, v: 0.1, s: []});
    var noise = SND.NoiseBuffer(ac);
    var opts = that.options;
    that.play = function(t, stepTime, data) {
      var conf = data[1] || {};
      var opts = SND.extend(that.options, conf);
      var smp = ac.createBufferSource();
      var flt = ac.createBiquadFilter();
      smp.connect(flt);
      var amp = SND.DCA(that.ac, flt, opts.v, t, 0.001, opts.d);
      flt.frequency.value = opts.f;
      flt.type = opts.ft;
      flt.Q.value = opts.q;
      smp.buffer = noise;
      smp.connect(amp);
      SND.sends(that.ac, sends, opts.s, amp);
      amp.connect(that.ac.destination);      
      smp.start(t);smp.stop(t + 0.001 + opts.d);
    }
    that.play = that.play.bind(that);
    return that;
  }
  SND.Drum = function(ac, sends, options) {
    var that = new SND.SProto(ac, sends, options, {sw: 0.05, d: 0.1, st: 200, en: 50, v: 0.8, s: []});
    that.play = function(t, stepTime, data) {
      var conf = data[1] || {};
      var opts = SND.extend(that.options, conf);
      var osc = that.ac.createOscillator();
      osc.type = opts.t || "sine";
      var click = that.ac.createOscillator();
      click.type = "square";
      SND.AD(osc.frequency, opts.en, opts.st, t, 0, opts.sw);
      SND.AD(click.frequency, opts.en, 100, t, 0, 0.001);
      var amp = SND.DCA(that.ac, osc, opts.v, t, 0.005, opts.d);
      var ampclick = SND.DCA(that.ac, click, opts.v, t, 0.005, 0.5);
      amp.connect(that.ac.destination);
      ampclick.connect(that.ac.destination);
      SND.sends(that.ac, sends, opts.s, amp);
      osc.start(t);osc.stop(t + 0.001 + opts.d);
      click.start(t);click.stop(t + 0.009);
    }
    that.play = that.play.bind(that);
    return that;
  };

  SND.Snare = function(ac, sends, options) {
    var that = new SND.SProto(ac, sends, options, {sw: 0.05, d:0.1, st:200, en:50,v:0.5, s:[]});
    // snare: drum with a higher fundamental + noise
    that.d = new SND.Drum(ac, sends, options);
    // less tail
    options.v /= 4;
    that.n = new SND.Noise(ac, sends, options);
    that.play =  function(t, stepTime, data) {
      that.d.play(t, stepTime, data);
      that.n.play(t, stepTime, data);
    };
    that.play = that.play.bind(that);
    return that;
  };
  SND.Synth = function(ac, sends, options) {
    var that = new SND.SProto(ac, sends, options, {t: 'sawtooth', q: 10, f: 200, fm: 1000, d: 1.0, v: 0.5, s: []});    
    that.play = function(t, stepTime, data) {
      var note = data[0];
      if (typeof(note) != 'number') {  // chord!
        note.forEach(function(n) {
          that.play(t, stepTime, [n, data[1]]);
        }, that);
        return;
      }
      var conf = data[1] || {};
      var opts = SND.extend(that.options, conf);
      var osc = that.ac.createOscillator();
      var flt = that.ac.createBiquadFilter();
      flt.Q.value = opts.q;
      osc.frequency.value = SND.n2f(note);
      osc.type = opts.t;
      len = stepTime * (conf.l || 1);
      osc.connect(flt);
      var amp = SND.DCA(this.ac, flt, opts.v, t, 0.01, len);
      SND.sends(that.ac, sends, opts.s, amp);
      amp.connect(ac.destination);
      SND.AD(flt.frequency, opts.f, opts.f + opts.fm, t, 0.01, len * opts.d);
      osc.start(t);osc.stop(t + len);
    }
    that.play = that.play.bind(that);
    return that;
  }

  SND.Sub = function(ac, sends, options) {
    var that = new SND.SProto(ac, sends, options, {t: 'sine', v:0.5});
    that.play = function(t, stepTime, data) {
      var note = data[0];
      var conf = data[1] || {};
      var opts = SND.extend(that.options, conf);

      var osc = that.ac.createOscillator();
      var f = SND.n2f(note);
      osc.frequency.value = f;
      osc.type = opts.t;
      len = stepTime * (conf.l || 1);
      var amp = SND.DCA(this.ac, osc, opts.v, t, 0.001, len * 4);
      // portamento/bass drop
      if (opts.dn) {
        SND.AD(osc.frequency, SND.n2f(opts.dn), f, t, 0, len);
      }
      amp.connect(ac.destination);
      osc.start(t);osc.stop(t + len);
    }
    that.play = that.play.bind(that);
    return that;
  }

  SND.Reese = function(ac, sends, options) {
    var that = new SND.SProto(ac, sends, options, {t: 'sawtooth', v:0.5});
    that.play = function(t, stepTime, data) {
      var note = data[0];
      var conf = data[1] || {};
      var opts = SND.extend(that.options, conf);

      var osc1 = that.ac.createOscillator();
      var osc2 = that.ac.createOscillator();
      var f = SND.n2f(note);
      osc1.frequency.value = osc2.frequency.value = f;
      osc1.type = osc2.type = opts.t;
      osc1.frequency.value = f;
      osc2.detune.value = 50; // a semitone
      len = stepTime * (conf.l || 1);
      var amp = SND.DCA(this.ac, osc1, opts.v, t, 0.00, len);
      var amp2 = SND.DCA(this.ac, osc2, opts.v, t, 0.00, len);

      // portamento
      if (opts.dn) {
        SND.AD(osc1.frequency, SND.n2f(opts.dn), f, t, 0, len);
        SND.AD(osc2.frequency, SND.n2f(opts.dn), f, t, 0, len);
      }

      var flt = ac.createBiquadFilter();
      var lfo = ac.createOscillator();
      lfo.frequency.value = opts.lfo * (140 / 120);
      lfo.type = "sine";
      var lfogain = ac.createGain();
      lfogain.gain.value = opts.co;
      lfo.connect(lfogain);
      lfogain.connect(flt.frequency);
      lfo.start(t); lfo.stop(t + 10);

      amp.connect(flt);
      amp2.connect(flt);

      SND.sends(that.ac, sends, opts.s, flt);

      osc1.start(t);osc1.stop(t + len);
      osc2.start(t);osc2.stop(t + len);
    }
    that.play = that.play.bind(that);
    return that;
  }


})(window);
