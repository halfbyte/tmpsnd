$(function() {
  
  var NOTENAMES = ['C-','C#','D-','D#','E-','F-','F#','G-','G#','A-','A#','B-'];
  INSTRUMENT_TYPES = ['SND.Drum', 'SND.Snare', 'SND.Noise', 'SND.Synth', 'SND.Sub', 'SND.Reese', 'SND.Organ']
  SEND_TYPES = ['SND.DEL', 'SND.REV', 'SND.DELREV', 'SND.DIST']
  var s = SONG;

//   if (localStorage['tmpsnd.songs.winning']) {
//     console.log("loading from localstorage");
//     s = JSON.parse(localStorage['tmpsnd.songs.winning'])
//   }


  window.SNDinstance = new SND(s);
  
  
  var $songContainer = $('#song-edit');
  renderSong();
  var $instrumentContainer = $('#instrument-edit');
  renderInstruments();
  var $sendContainer = $('#send-edit');
  renderSends();
  
  
  
  var $instrumentSelector = $('#instrument-select');
  $instrumentSelector.on('change', function(e) { cmd.changeinstrument($(this).val()); } )

  s.instruments.forEach(function(inst, i) {
    $instrumentSelector.append("<option value='" + i + "'>" +  i + ": " + inst[0] + "</option>");
  });

  $('body').keydown(function(e) {
    if (e.keyCode == 40) {
      cmd.advanceLine(1);
      e.preventDefault();
    } else if (e.keyCode == 38) {
      cmd.advanceLine(-1);
      e.preventDefault();      
    } else if (e.keyCode == 9) {
      if (e.shiftKey) {
        cmd.advanceColumn(-1);
      } else {
        cmd.advanceColumn(1);
      }      
      e.preventDefault();
    } else {
      console.log(e.keyCode);
    }
    
  })

  $('body').on('click', '[data-cmd]', function(e) {
    $t = $(e.target);
    param = $t.data('param');
    cmd[$t.data('cmd')](param, $t);
    e.preventDefault();
  }).on('change', '[data-chgcmd]', function(e) {
    $t = $(e.target);
    param = $t.data('param');
    cmd[$t.data('chgcmd')](param, $t.val());
    e.preventDefault();    
  });
  
  var $patternSelector = $('#pattern-select');
  $patternSelector.on('change', function(e) { cmd.changepattern($(this).val()); } )
  
  var $patternContainer = $('#pattern-edit');
  
  
  var state = {
    currentPattern: 0,
    currentInstrument: 0,
    currentLine: 0,
    currentColumn: 0
  }
  
  var cmd = {
    itv: null,
    playsong: function(p) {
      SNDinstance.p();
      itv = setInterval(function() {
        var i = Math.floor(SNDinstance.t());
        var line = document.querySelector("#line-" + (i % 64));
        line.classList.add("highlight");
        if (line.previousSibling) {
          line.previousSibling.classList.remove("highlight");
        } else {
          var prev = document.querySelector("#line-63");
          if (prev) {
            line.classList.remove("highlight");
          }
        }
      }, 16);
    },
    stop: function(p) {
      if (SNDinstance) {
        SNDinstance.s();
        clearInterval(this.itv);
      }
    },
    changeinstrparam: function(p, val) {
      try {
        var parsed = JSON.parse(val);
        s.instruments[parseInt(p, 10)][1] = parsed;
        renderInstruments();
        renderSong();
        SNDinstance.initInstruments()      
      } catch(e) {
        console.log(e)
        alert("Not valid JSON, please try again")
      }
    },
    changesendparam: function(p, val) {
      try {
        var parsed = JSON.parse(val);
        s.sends[parseInt(p, 10)][1] = parsed;
        renderSends();
        SNDinstance.initSends()
        SNDinstance.initInstruments()
      } catch(e) {
        console.log(e)
        alert("Not valid JSON, please try again")
      }
    },

    changeinstrtype: function(p, val) {
      s.instruments[parseInt(p, 10)][0] = val;
      renderInstruments();
      renderSong();
      SNDinstance.initInstruments()
    },
    changesendtype: function(p, val) {
      s.sends[parseInt(p, 10)][0] = val;
      renderSends();
      SNDinstance.initSends()
      SNDinstance.initInstruments()
    },
    addsend: function(p) {
      s.sends.push(['SND.REV', {}]);
      renderSends();
      SNDinstance.initSends()
      SNDinstance.initInstruments()
    },
    removesend: function(p) {
      s.sends.pop()
      renderSends();
      SNDinstance.initSends()
      SNDinstance.initInstruments()
    },
    addinstrument: function(p) {
      s.instruments.push(['SND.Noise', {}])
      renderInstruments();
      renderSong();
      SNDinstance.initInstruments()
    },
    removeinstrument: function(p) {
      s.instruments.pop()
      renderInstruments();
      renderSong();
      SNDinstance.initInstruments()
    },
    addsongstep: function(p) {
      s.playlist.push({})
      renderSong();
    },
    removesongstep: function(p) {
      s.playlist.pop()
      renderSong();
    },
    changepattern: function(p) {
      cmd.submitChange()
      state.currentPattern = parseInt(p, 10);
      renderCurrentPattern();
    },
    sequence_prevpattern: function(p) {
      address = p.split(":");
      pos = parseInt(address[0], 10);
      inst = parseInt(address[1], 10);
      cp = s.playlist[pos][inst];
      if (cp > 0) s.playlist[pos][inst] = cp - 1;              
      renderSong();
    },
    sequence_nextpattern: function(p) {
      address = p.split(":");
      pos = parseInt(address[0], 10);
      inst = parseInt(address[1], 10);
      cp = s.playlist[pos][inst];
      if (typeof(cp) == 'undefined') cp = -1;
      s.playlist[pos][inst] = cp + 1;
      if(typeof(s.patterns[cp + 1]) == 'undefined') {
        s.patterns[cp + 1] = new Array(64);
      }
      renderSong();
    },
    changeinstrument: function(p) {
      state.currentInstrument = parseInt(p,10);
      renderPatternList();
    },
    advanceLine: function(num) {
      cmd.submitChange()
      state.currentLine += num;
      checkPatternOverflow();
      renderCurrentPattern();
    },
    advanceColumn: function(num) {
      cmd.submitChange()
      state.currentColumn += num;
      checkPatternColumnOverflow();
      renderCurrentPattern();
    },
    submitChange: function() {
      /* Notiz an selbst: Problem ist das doppelte Aufrufen von cmd.submitChange beim aufrufen von changeinstrument */
      
      if (state.currentColumn == 0) {
        value = $('input.note').val()
        if (typeof(value) !== 'undefined') submitNote(value);        
      } else {
        value = $('input.param').val()
        if (typeof(value) !== 'undefined') submitParam(value);
      }
    },
    save: function() {
      console.log("Saving", s)
      localStorage['tmpsnd.songs.winning'] = JSON.stringify(s);
    },
    'export': function() {
      console.log("export")
      $('body').append("<div class='export-overlay'><textarea cols=80 rows=20>" + JSON.stringify(s) + "</textarea><button id='close-export-overlay'>CLOSE</button></div>");
      $('.export-overlay textarea').focus(function() {this.select();});
      $('.export-overlay #close-export-overlay').click(function(e) {
        e.preventDefault();
        $('.export-overlay').remove();
      })
    }
    
  };
  
  function submitParam(param) {
    params = param.split(",")
    noteInPattern = s.patterns[state.currentPattern][state.currentLine];
    newParams = {}
    params.forEach(function(p,i) {
      p = p.trim();
      all = p.split(":")
      if (all.length == 2) {
        value = parseFloat(all[1]);
        if (isNaN(value)) value = all[1].trim();
        newParams[all[0].trim()] = value;
      }
    });
    if (typeof(noteInPattern) === 'object') {
      s.patterns[state.currentPattern][state.currentLine][1] = newParams;
    } else {
      s.patterns[state.currentPattern][state.currentLine] = [s.patterns[state.currentPattern][state.currentLine], newParams]
    }
  }
  
  function submitNote(note) {
    notes = note.split(",");
    noteInPattern = s.patterns[state.currentPattern][state.currentLine];
    
    instruType = s.instruments[state.currentInstrument][0];
    
    notes.forEach(function(not,i) {
      not = not.toUpperCase().trim();
      res = not.match(/([A-G][-#]?)(\d)/)
      if (res) {
        notename = res[1]
        console.log("N",notename)
        if (notename.length == 1) notename = notename + "-";
        console.log("NA",notename)
        key = NOTENAMES.indexOf(notename);
        console.log("KEY", key)
        if (key != -1) {
          oct = parseInt(res[2],10)
          notes[i] = (12 * oct) + key;
        } else {
          notes[i] = 0
        }
      }
    });
    if (notes.length == 1) {
      notes = notes[0];
    }
    if(typeof(noteInPattern) === 'object') {
      s.patterns[state.currentPattern][state.currentLine][0] = notes;
    } else {
      s.patterns[state.currentPattern][state.currentLine] = notes;
    }
  }
  
  function checkPatternColumnOverflow() {
    if (state.currentColumn > 1) state.currentColumn = 0;
    if (state.currentColumn < 0) state.currentColumn = 1;
  }
  
  function checkPatternOverflow() {
    var pattern = s.patterns[state.currentPattern];
    if (state.currentLine > (pattern.length - 1)) {
      state.currentLine = state.currentLine - pattern.length;
    }
    if (state.currentLine < 0) {
      state.currentLine = pattern.length + state.currentLine;
    }
  }


  
  
  function renderPatternList() {
    $patternSelector.html("");
    s.patterns.forEach(function(p, i) {
      $patternSelector.append("<option>" +  i + "</option>");
    });
    state.currentPattern = 0;
    state.currentLine = 0;
    state.currentColumn = 0;
    renderCurrentPattern()
  }
  
  function renderSong() {
    $songContainer.html("");
    var headers = "";
    s.instruments.forEach(function(inst, i) {
      headers += "<th>" + i + "<br>" + inst[0] + "</th>";
    });
    $songContainer.append('<thead><tr>' + headers + "</tr></thead>");
    var lines = "";
    s.playlist.forEach(function(pos, seq) {
      var line = "";
      s.instruments.forEach(function(inst, i) {
        if (typeof(pos[i]) !== 'undefined') {
          line += "<td><a href='#' data-cmd='changepattern' data-param='" + pos[i] + "'>" + pos[i] + "</a><a href='#' class='minibutton' data-cmd='sequence_nextpattern' data-param='" + seq  + ":" + i + "'>+</a> <a href='#' class='minibutton' data-cmd='sequence_prevpattern', data-param='" + seq  + ":" + i + "'>-</a></td>";
        } else {
          line += "<td>-<a href='#' class='minibutton' data-cmd='sequence_nextpattern' data-param='" + seq  + ":" + i + "'>+</a></td>";
        }
      });
      lines += "<tr>" + line + "</tr>";
    })
    $songContainer.append('<tbody>' + lines + "</thead>");
  }
  
  function instrTypeSelector(instr, index) {
    var select = "<select data-chgcmd='changeinstrtype' data-param='" + index + "' id='instr-" + index + "'>"
    INSTRUMENT_TYPES.forEach(function(t) {
      select += "<option " + (instr === t ? 'selected' : '') + ">" + t + "</option>"
    });
    return select + "</select>"
  }
  function sendTypeSelector(send, index) {
    var select = "<select data-chgcmd='changesendtype' data-param='" + index + "' id='send-" + index + "'>"
    SEND_TYPES.forEach(function(t) {
      select += "<option " + (send === t ? 'selected' : '') + ">" + t + "</option>"
    });
    return select + "</select>"
  }
  
  function renderInstruments() {
    $instrumentContainer.html("")
    s.instruments.forEach(function(instr, i) {
      $instrumentContainer.append("<tr><td>" + i + "</td><td>" + instrTypeSelector(instr[0], i) + "</td><td><td><input data-chgcmd='changeinstrparam' data-param='" + i + "' size='80' type='text' value='" + JSON.stringify(instr[1]) + "'></td></tr>")
    });
  }
  
  function renderSends() {
    $sendContainer.html("")
    s.sends.forEach(function(send, i) {
      $sendContainer.append("<tr><td>" + i + "</td><td>" + sendTypeSelector(send[0], i) + "</td><td><td><input data-chgcmd='changesendparam' data-param='" + i + "' size='80' type='text' value='" + JSON.stringify(send[1]) + "'></td></tr>")
    });
  }
  
  function hexline(line) {
    outline = line.toString(16)
    if (outline.length == 1) outline = "0" + outline;
    return outline
  }
  
  function renderCurrentPattern () {
    var pattern = s.patterns[state.currentPattern];
    var currentInstrument = s.instruments[state.currentInstrument];
    var instrumentType = currentInstrument[0]
    $patternContainer.html("");
    pattern.forEach(function(line, i) {
      var current = i === state.currentLine;
      $patternContainer.append("<div class='" + (current ? 'current-line' : '') + "' id='line-" + i + "'><span class='line-number'>" + hexline(i) + "</span>" + renderLine(line, instrumentType, current) + "</div>");
    })
    focusInput();
  }
  
  function focusInput() {
    if (state.currentColumn == 0)
      $('input.note').focus().select();
    else
      $('input.param').focus();
  }
  
  function fullNoteName(note) {
    if (note > 0) {
      return NOTENAMES[note % 12] + Math.floor(note / 12)
    } else {
      return " "
    }
  }
  
  function renderParams(p) {
    rp = []
    for(key in p) {
      if( p.hasOwnProperty(key)) {
        rp.push(key.trim() + ": " + ("" + p[key]).trim())
      }
    }
    return rp.join(", ")
  }
  
  function renderLine(l, t, c) {
    if (typeof(l) == 'object') {
      notes = l[0]
      additionals = l[1]
    } else {
      notes = l
      additionals = {}
    }
    var renderedNotes = []
    if (typeof(notes) == 'object') {

      notes.forEach(function(note) {
        renderedNotes.push(fullNoteName(note));
      });

    } else {
      renderedNotes = [fullNoteName(notes)];
    }
    
    
    if (c) {
      if (state.currentColumn == 0) {
        return "[<input type='text' class='note' value='" + (notes === 0 ? ' ' : renderedNotes.join(","))  + "'>] {" + renderParams(additionals) + "}";
      } else {
        return "[<span class='note'>" + (notes === 0 ? ' ' : renderedNotes.join(","))  + "</span>] {<input class='param' type='text' value='" + renderParams(additionals) + "'>}";
      }
    } else {
      return "[<span class='note'>" + (notes === 0 ? ' ' : renderedNotes.join(","))  + "</span>] {" + renderParams(additionals) + "}";
    }
    
  }
    
    
  function init() {
    cmd.changepattern(0);
    renderPatternList();
  }
  
  
  init();
  
  // SND extensions  
  
  
})
