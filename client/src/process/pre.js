const fs = require('fs-extra');
const replace = require('replace-in-file');


async function pre() {
  try {
    // copy libraries to src
    await fs.copy('../lib', 'src/lib');
    console.log('copied: lib -> src');
    
    // copy libraries to public
    await fs.copy('../lib', 'public/lib');
    console.log('copied: lib -> public');
    
    // copy browserified idb to public
    await fs.copy('node_modules/idb/build/idb.js', 'public/lib/idb.js');
    console.log('copied: idb -> public/lib');
    
    // copy browserified semaphore to public
    await fs.copy('node_modules/semaphore/lib/semaphore.js', 'public/lib/semaphore.js');
    console.log('copied: semaphore -> public/lib');
    
    // comment out ES6 export in public lib files
    const ES6modList = await replace({
      files: ['public/lib/*'],
      from: /^(export default)/gm,
      to: '// $1',
    });
    console.log('ES6 export is disabled:', ES6modList);
  } catch(err) {
    console.error(err);
  }
}

pre();