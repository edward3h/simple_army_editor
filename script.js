console.log('hi');

var BLANK = /^\s*$/;
var INDENTS = /^\s*/;
var POINTS = /\s\[\s*(\d+)\s*\]/;
var MULTIPLIER = /\s[x*]\s*(\d+)/;
var ANNOTATION = /.+\:.+/;
var HEADER = /^\s*(\#+)(.+)/;
var STYLE = /^\s*\!(.+)/;

var state = function() {
  var LEVELS = ["detachment", "category", "unit", "option"];
  var indents = [];
  var total = 0;
  var lastLevel = {};

  return {
    addIndent: function(newIndent) {
      if(!indents.includes(newIndent)) {
        indents.push(newIndent);
        indents.sort(function (a, b) {  return a - b;  });
      }
    },
    getLevel: function(indent) {
      var index = indents.indexOf(indent);
      if(index > -1 && index < LEVELS.length) {
        return LEVELS[index];
      }
      return "err";
    },
    clear: function() {
      indents = [];
      total = 0;
    },
    levelDiff: function(prevIndent, newIndent) {
      var prevIndex = indents.indexOf(prevIndent);
      var newIndex = indents.indexOf(newIndent);
      if(prevIndex > -1 && newIndex > -1) {
        return prevIndex - newIndex;
      }
      return -1;
    },
    addTotal: function(value) {
      total += value;
    },
    getTotal: function() {
      return total;
    },
    getParent: function(indent) {
      var index = indents.indexOf(indent);
      if (index > 0 && index < LEVELS.length) {
        var parentLevel = LEVELS[index - 1];
        return lastLevel[parentLevel];
      }
      return null;
    },
    lastLine: function(indent, line) {
      var index = indents.indexOf(indent);
      if(index > -1 && index < LEVELS.length) {
        var level = LEVELS[index];
        lastLevel[level] = line;
        console.log("lastLevel", level, line);
      }
    }
  };
}();

function parseCosts(line) {
  var points = line.text.match(POINTS);
  if (points && points.length > 0) {
    var cost = parseInt(points[1], 10);
    if (!isNaN(cost)) {
      line.cost = cost;
      line.multiplier = 1;
      line.total = cost;

      var mult = line.text.match(MULTIPLIER);
      if(mult && mult.length > 1) {
        var multiplier = parseInt(mult[1], 10);
        if(!isNaN(multiplier)) {
          line.multiplier = multiplier;
          line.total = cost * multiplier;
        }
      }

      state.addTotal(line.total);
    }
  }
}

function parseLine(lines, text) {
  if (text.match(BLANK)) {
    return;
  }
  var indents = text.match(INDENTS)[0].length;
  state.addIndent(indents);
  var line = {text: text, indents: indents};
  parseCosts(line);
  var headerMatch = text.match(HEADER);
  if (headerMatch) {
    line.header = headerMatch[1].length;
    line.text = headerMatch[2];
  }
  var styleMatch = text.match(STYLE);
  if (styleMatch) {
    line.style = true;
    line.text = styleMatch[1];
  }

  lines.push(line);
  var parent = state.getParent(indents);
  console.log("parent", indents, parent);
  if (parent) {
    if (!parent.children) {
      parent.children = [];
    }
    parent.children.push(line);
  }
  state.lastLine(indents, line);
}

function sumTotal(line) {
  var sum = line.total || 0;
  if (line.children) {
    for (var i = 0; i < line.children.length; i++) {
      sum += sumTotal(line.children[i]);
    }
  }
  return sum;
}

function renderLine(line, klass) {
  var annotation = line.text.match(ANNOTATION);
  var spanclass = annotation ? "annotation text" : "text";
  var r = "<div class=\"" + klass + "\"><div class=\"inner\"><span class=\"" + spanclass + "\">" +
    line.text + "</span>";
  if(line.total && line.total > 0) {
    r += "<span class=\"total\">" + line.total + "</span>";
    r += "<span class=\"sumtotal\">" + (klass.includes("unit") ? sumTotal(line) : '') + "</span>";
  }
  r += "</div>";
  return r;
}

function renderHeader(line) {
  return "<h" + line.header + ">" + line.text + "</h" + line.header + ">";
}

function renderFooter() {
  return "<div class=\"footer\">Edward's Simple Army Editor - http://roster.ordoacerbus.com/</div>";
}

function renderLines(lines) {
  var prevIndent;
  var r = "";
  var s = "";
  for(var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if(line.style) {
      s += "#result " + line.text + "\n"
      continue;
    }
    if(line.header) {
      r += renderHeader(line);
      continue;
    }
    var diff = state.levelDiff(prevIndent, line.indents);
    if(diff > -1) {
      for(var l = diff + 1; l > 0; l--) {
        r+= "</div>";
      }
    }
    var klass = "row " + state.getLevel(line.indents);
    if(diff > 0) {
      klass += " drop1";
    }
    r += renderLine(line, klass);
    prevIndent = line.indents;
  }
  var diff = state.levelDiff(prevIndent, 0);
  if(diff > -1) {
    for(var l = diff + 1; l > 0; l--) {
      r+= "</div>";
    }
  }
  r += "<div class=\"row totalrow\"><span>Total: </span><span class=\"total\">" + state.getTotal() + "</span></div>";
  return "<style>\n" + s + "</style>\n" + r + renderFooter();
}

function textChange(cm, target) {
  state.clear();
  var lines = [];
  cm.eachLine(function (lh) {
    parseLine(lines, lh.text);
  });
  var outputText = renderLines(lines);
  target.innerHTML = outputText;
}

window.onload = function () {
  var source = document.getElementById('source');
  var loaded = false;
  if (typeof(Storage) !== "undefined") {
    var stored = localStorage.getItem("roster");
    source.value = stored;
    loaded = true;
  }
  var cm = CodeMirror.fromTextArea(source, {
    lineNumbers: true
  });
  var result = document.getElementById('result');
  var timer;

  function wrapper2() {
    textChange(cm, result);
    if (typeof(Storage) !== "undefined") {
      cm.save();
      localStorage.setItem("roster", source.value);
    }
  }

  function wrapper() {
    clearTimeout(timer);
    timer = setTimeout(wrapper2, 500);
  }

  cm.on('change', wrapper);
  if(loaded) {
    wrapper2();
  }

  const fontSelectElement = document.getElementById('font-selector');

  fontSelectElement.addEventListener('change', (event) => {
    const fontFamilyValue = event.target.value
    document.body.style.fontFamily = fontFamilyValue;
  });
}

