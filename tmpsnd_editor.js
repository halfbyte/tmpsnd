$(function() {
  
  var NOTENAMES = ['C-','C#','D-','D#','E-','F-','F#','G-','G#','A-','A#','B-'];
  
  var s = SONG;



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
    changepattern: function(p) {
      cmd.submitChange()
      state.currentPattern = parseInt(p, 10);
      renderCurrentPattern();
    },  
    changeinstrument: function(p) {
      cmd.submitChange()
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
    }
    
    
  };
  
  function submitParam(param) {
    params = param.split(",")
    noteInPattern = s.patterns[state.currentInstrument][state.currentPattern][state.currentLine];
    newParams = {}
    params.forEach(function(p,i) {
      p = p.trim();
      all = p.split(":")
      if (all.length == 2) {
        newParams[all[0].trim()] = all[1];
      }
    });
    if (typeof(noteInPattern) === 'object') {
      s.patterns[state.currentInstrument][state.currentPattern][state.currentLine][1] = newParams;
    } else {
      s.patterns[state.currentInstrument][state.currentPattern][state.currentLine] = [s.patterns[state.currentInstrument][state.currentPattern][state.currentLine], newParams]
    }
  }
  
  function submitNote(note) {
    notes = note.split(",");
    noteInPattern = s.patterns[state.currentInstrument][state.currentPattern][state.currentLine];
    
    instruType = s.instruments[state.currentInstrument][0];
    
    notes.forEach(function(not,i) {
      not = not.trim();
      if (instruType === 'SND.Drum' || instruType === 'SND.Noise') {
        if (not === '*') {
          notes[i] = 1
        } else {
          notes[i] = 0
        }        
      } else {
        res = not.match(/([A-G][-#]?)(\d)/)
        if (res) {
          notename = res[1]
          if (notename.length == 1) notename = notename + "-";
          key = NOTENAMES.indexOf(res[1]);
          if (key != -1) {
            oct = parseInt(res[2],10)
            notes[i] = (12 * oct) + key;
          } else {
            notes[i] = 0
          }
          
        } else {
          notes[i] = 0;
        }
      }
    });
    if (notes.length == 1) {
      notes = notes[0];
    }
    if(typeof(noteInPattern) === 'object') {
      s.patterns[state.currentInstrument][state.currentPattern][state.currentLine][0] = notes;
    } else {
      s.patterns[state.currentInstrument][state.currentPattern][state.currentLine] = notes;
    }
  }
  
  function checkPatternColumnOverflow() {
    if (state.currentColumn > 1) state.currentColumn = 0;
    if (state.currentColumn < 0) state.currentColumn = 1;
  }
  
  function checkPatternOverflow() {
    var pattern = s.patterns[state.currentInstrument][state.currentPattern];
    if (state.currentLine > (pattern.length - 1)) {
      state.currentLine = state.currentLine - pattern.length;
    }
    if (state.currentLine < 0) {
      state.currentLine = pattern.length + state.currentLine;
    }
  }
  
  function renderPatternList() {
    $patternSelector.html("");
    s.patterns[state.currentInstrument].forEach(function(p, i) {
      $patternSelector.append("<option>" +  i + "</option>");
    });
    state.currentPattern = 0;
    state.currentLine = 0;
    state.currentColumn = 0;
    renderCurrentPattern()
  }
  
  function renderCurrentPattern () {
    var pattern = s.patterns[state.currentInstrument][state.currentPattern];
    var currentInstrument = s.instruments[state.currentInstrument];
    var instrumentType = currentInstrument[0]
    $patternContainer.html("");
    pattern.forEach(function(line, i) {
      var current = i === state.currentLine;
      $patternContainer.append("<div class='" + (current ? 'current-line' : '') + "' id='line-" + i + "'>" + renderLine(line, instrumentType, current) + "</div>");
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
    return NOTENAMES[note % 12] + Math.floor(note / 12)
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
    if (t == 'SND.Drum' || t == 'SND.Noise') {
      if (typeof(l) === 'object') {
        note = l[0]
        additionals = l[1]
      } else {
        note = l
        additionals = {}
      }
      if (c) {
        if (state.currentColumn == 0) {
          return "[<input size=1 type='text' class='note' value='" + (note === 0 ? ' ' : '*')  + "'>] {" + renderParams(additionals) + "}";
        } else {
          return "[<span class='note'>" + (note === 0 ? ' ' : '*')  + "</span>] {<input class='param' type='text' value='" + renderParams(additionals) + "'>}";
        }
      } else {
        return "[<span class='note'>" + (note === 0 ? ' ' : '*')  + "</span>] {" + renderParams(additionals) + "}";
      }
      
    } else if (t == 'SND.Synth') {
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
  }
  
  function init() {
    cmd.changeinstrument(0);
  }
  
  
  init();
  
})