'use strict'

// The Level class contains most of the assets.
class Level {
    constructor(game, number, canvas) {
      
        this.game = game;
        this.number = number;
        this.cnv = canvas;
        this.init();  
    }
    
    init() {    
                // needs to be called each time a level is re-started
                // different level numbers should have different behavior
                this.cnv.background(255, 0, 0);
      //  init turrets
      
      //  init enemies
      
      //  init bullets
    }
    
    run() {
        this.render();
        this.handleTowers();
        this.handleEnemies();
    }
    
  
    
    render() {
        // draw whatever
        // here is some place holder
      push();
      background(128);
      var levelText = ["Zero", "One", "Two","Three"]; 
      var p = createP("Level " + levelText[this.number]);  // p5.dom.js
      p.style("font-size", "48px");
      p.position(250,200);
      pop();
    }
    
     handleTowers(){
       
     }
    handleEnemies(){
      
    }

}