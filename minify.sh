mkdir -p tools

if [ ! -f tools/compiler.jar ]; then
    echo " -- tools/compiler.jar not found, now downloading it..."
    wget -O tools/compiler-latest.zip "http://dl.google.com/closure-compiler/compiler-latest.zip"
    cd tools && unzip compiler-latest.zip && cd ..
fi

cat tmpsnd.js song_1.js > out.js

echo " -- running the closure compiler..."
java -jar tools/compiler.jar --js=out.js --js_output_file=./tmpsnd.min.js --compilation_level=ADVANCED_OPTIMIZATIONS --externs ./tools/w3c_audio.js

echo " -- packing in a png..."
ruby tools/pnginator.rb tmpsnd.min.js demo.png.html

echo " -- done."

wc -c tmpsnd.js
wc -c song_1.js
wc -c out.js
wc -c tmpsnd.min.js
wc -c demo.png.html
