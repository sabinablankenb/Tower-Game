'use strict'

// wait for the window to load and than call back setup()
window.addEventListener('load', setup, false);

var towerGame;   // the global game object
const FRAME_RATE=30;
var cellId = 0;


function setup() {
  towerGame = new Game();
  window.setTimeout(draw, 100);    // wait 100ms for resources to load then start draw loop
}

function draw() {   // the animation loop
    towerGame.run();
    window.setTimeout(draw, 1000/FRAME_RATE);  // come back here every interval
}

// Game is the top level object and it contains the levels
class Game {
  //  This is a test
  constructor() { // from setup()
    this.isRunning = true;
    this.placingTower = false;
    this.currentTower = 0;
    this.towerType = 0;
    this.gameTime = 0;
    this.towers = [];
    this.enemies = [];
    this.bullets = [];
    this.bankValue = 500;
    this.canvas = document.createElement("canvas");
    if(!this.canvas || !this.canvas.getContext)
        throw "No valid canvas found!";
    this.canvas.width = 900;
    this.canvas.height = 750;
    document.getElementById('canDiv').appendChild(this.canvas);
    this.context = this.canvas.getContext("2d");
    if(!this.context)
        throw "No valid context found!";
    this.lastTime = Date.now();
    //select everything of type/class and set call backs
    this.tileDivs = this.createTileDivs();
    this.loadDOMCallBacks(this.tileDivs);
    // select canvas for callbacks
    this.canvas.addEventListener('mousemove',this.handleCNVMouseMoved,false);
    this.canvas.addEventListener('mouseover',this.handleCNVMouseOver, false);
    this.canvas.addEventListener('click', this.handleCNVMouseClicked, false);

    window.addEventListener('keypress', function(evt) {
        if(evt.key == "E" || evt.key == "e")
            towerGame.sendEnemies();
        }, false);

    this.mouseX = 0;
    this.mouseY = 0;
    this.w = 20;
    this.done = false;
    // containerarrays for cells
    this.grid = [];
    this.cols = Math.floor(this.canvas.width / this.w);
    this.rows = Math.floor(this.canvas.height / this.w);

    this.loadGrid();
    this.root = this.grid[this.cols - 1][this.rows -1];
    this.brushfire();
}

  // The success callback when a tower canvas image
  // or bullet image has loaded.  Hide them from
  // displaying on the page.
  hideImgElement() { this.style.display = "none"; }

  run() { // called from draw()
    let gt = this.updateGameTime();
    this.updateInfoElements(gt);
    this.removeBullets();
    this.removeEnemies();
    if (this.isRunning) {
      this.render();
    }

    // draw the grid
    for(let i = 0; i < this.cols; i++){
      for(let j = 0; j < this.rows; j++){
        this.grid[i][j].render();
      }
    }
     // draw the towers
    for (let i = 0; i < this.towers.length; i++) {
      this.towers[i].run();
    }
    for (let i = 0; i < this.enemies.length; i++) {
      this.enemies[i].run();
    }
    for (let i = 0; i < this.bullets.length; i++) {
      this.bullets[i].run();
    }

    // some help text in the bottom left of the canvas
    this.context.save();
    this.context.fillStyle = "white";
    this.context.font = "14px sans-serif";
    this.context.fillText("Press the E key to send enemies", 20, this.canvas.height-20);
    this.context.restore();
  }

  render() { // draw game stuff
    this.context.clearRect(0,0,this.canvas.width, this.canvas.height);

  }

      // brushfire()
    // starting with the 'root' cell, which is the bottom right cell of the grid
    // assign a "distance" to all other cells where the distance is the
    // accumulated steps from that cell to the root cell.
    // An adjacent neighbor has a step of 10
    // and a diagonal neighbor has a step of 14.

  brushfire() {
    // Initialize each cell in the grid to have a distance that
    // is the greatest possible.  Initialize each cell to
    // have no parent and populate it's array of neighbors
    for(var i = 0; i < this.cols; i++){
      for(var j = 0; j < this.rows; j++){
        var cell = this.grid[i][j];
        cell.dist = this.cols * this.rows * 10;     // set distance to max
        cell.vec = null;    // clear parent vector
        cell.parent = 0;    // clear parent
        cell.addNeighbors(this,  this.grid); // fill the neighbors array
      }
    }
    // Initialize the fifo queue with the root cell
    this.root.dist = 0;
    this.root.occupied = false; // in case it was randomly set occupied
    var queue = [this.root];

    // loop as long as the queue is not empty, removing the first cell
    // in the queue and adding all its neighbors to the end of the
    // queue.  The neighbors will only be those that are not occupied
    // and not blocked diagonally.
    while(queue.length) {
        var current = queue.shift();   // remove the first cell from the queue
        // for all its neighbors...
        for(let j =0; j < current.neighbors.length; j++){
            let neighbor = current.neighbors[j];
            var dist = current.dist+10; // adjacent neighbors have a distance of 10
            if(current.loc.x != neighbor.loc.x && current.loc.y != neighbor.loc.y)
                dist = current.dist+14; // diagonal neighbors have a distance of 14
            // if this neighbor has not already been assigned a distance
            // or we now have a shorter distance, give it a distance
            // and a parent and push to the end of the queue.
            if(neighbor.dist > dist) {
                neighbor.parent = current;
                neighbor.dist = dist;
                queue.push(neighbor);
                }
          }     // for each neighbor
        }   // while(queue.length)

    // delete any enemy that is currently in a cell without a parent
    for(let i = 0; i < this.enemies.length;  i++) {
        let enemy = towerGame.enemies[i];
        if(!enemy.currentCell.parent)
            enemy.kill = true;    // kill the orphans
        }

        // give each cell a vector that points to its parent
//       for(var i = 0; i < this.cols; i++){
//         for(var j = 0; j < this.rows; j++){
//           this.grid[i][j].vec = this.grid[i][j].getVector();
//         }
//       }

    }

    // sendEnemies()
    // Send a random number of enemies, up to 5, each from a random location
    // in the top half of the grid.  About half of the enemies will take the
    // optimal path simply by following the parent chain and about half will
    // take a path of randomly choosing cells to be next on the path
    // from all those cells with a distance to the root that is
    // less than its current location.
    // A valid cell to start the enemy must have a parent because lack
    // of a parent means either it is occupied or it is blocked from any path.
    sendEnemies() {
        var numEnemies = Math.random() * 5;     // up to 5 enemies
        var row, col, startCell, i, j;
        for( i = 0; i < numEnemies; i++) {
            for(j = 0; j < 3; j++) { // try 3 times to find valid start cell
                let row = Math.floor(Math.random() * (this.rows/2));    // top  half of rows
                let col = Math.floor(Math.random() * this.cols);        // any column
                startCell = this.grid[col][row];
                if(startCell && startCell.parent)   // must have a parent to have any path
                    break;
                }
            if(j < 3) { // if we found a valid cell to start the enemy
                let randomPath = Math.floor(Math.random() * 2);    // about half
                this.enemies.push(new Enemy(this, startCell, randomPath));
                }
            }
    }

    // Delete any enemies that have died
    removeEnemies() {
      for(let i = this.enemies.length-1; i >= 0; i--) {
        if(this.enemies[i].kill)
            this.enemies.splice(i,1);   // delete this dead enemy
        else this.enemies[i].run();
        }
    }

  removeBullets(){
    if(this.bullets.length < 1) return;
    for(let i = this.bullets.length-1; i >= 0; i--){

       if( this.bullets[i].loc.x < 0 ||
           this.bullets[i].loc.x > this.canvas.width ||
           this.bullets[i].loc.y < 0 ||
           this.bullets[i].loc.y > this.canvas.height ){
             this.bullets.splice(i, 1);
           }

    }
  }
  updateInfoElements(time){
    let infoElements = document.getElementById('infoDiv').getElementsByClassName('infoTileDiv');
    for(let i = 0; i < infoElements.length; i++){
      let info = infoElements[i];
      // change the html content after condition--use indexOf
      if(info.innerHTML.indexOf('Bank') != -1){
        info.innerHTML = 'Bank <br/>' + this.bankValue;
      }else if(info.innerHTML.indexOf('Time') != -1){
        info.innerHTML = 'Time <br/>' + time;
      }
    }
  }

  updateGameTime(){
    var millis = Date.now();
    if(millis - this.lastTime >= 1000) {
      this.gameTime++;
      this.lastTime = millis;
    }
    return this.gameTime;
  }

   // +++++++++++++++++++++++++++++++++++++++++++  load a 2D array with cells
  loadGrid(){
    for(var i = 0; i < this.cols; i++){     // columns of rows
      this.grid[i] = [];
      for(var j = 0; j < this.rows; j++){
        this.grid[i][j] = new Cell(this, vector2d((i*this.w), (j*this.w)), ++cellId);
        // make 10% of the cells occupied
        if(this.grid[i][j] != this.root && Math.floor(Math.random()*100) < 10)
            this.grid[i][j].occupied = true;
      }
    }

  }  // ++++++++++++++++++++++++++++++++++++++++++++++  End LoadGrid



  // Create the divs to hold the menu of towers with
  // the large images.  This divs also contain the
  // parameters for creating towers to be drawn on the
  // canvas.
  createTileDivs(){
    var tiles = [];

    for(var i = 0; i < 5; i++){
      var mtd = document.createElement("div"); // createDiv("");
      var cnvTurImgPath = "tow" + (i+1) + "s.png";  // small tower image for canvas
      var cnvBulImgPath = "b" + (i+1) + ".png";     // bullet image for canvas
      mtd.cnvTurImg = new Image();
      mtd.cnvTurImg.addEventListener('load',this.hideImgElement,false);
      mtd.cnvTurImg.addEventListener('error', function() { console.log(cnvTurImgPath + " failed to load"); }, false);
      mtd.cnvTurImg.src = cnvTurImgPath;    // start loading image

      mtd.cnvBulImg = new Image();
      mtd.cnvBulImg.addEventListener('load',this.hideImgElement,false);
      mtd.cnvBulImg.addEventListener('error', function() { console.log(cnvBulImgPath + " failed to load"); }, false);
      mtd.cnvBulImg.src = cnvBulImgPath;    // start loading image

      document.getElementById("menuDiv").appendChild(mtd);

      mtd.cost = 100*i +50;
      mtd.id = 'towImgDiv' + i;
      tiles.push(mtd);
      var imgName = 'tow' + i + '.png'; // large image for menu tile
      var tImg = new Image();
      tImg.addEventListener('error', function() { console.log(imgName + " failed to load"); }, false);
      tImg.src = imgName;
      mtd.appendChild(tImg);
    }
    return tiles;
  }

  getBankValue(){
    return this.bankValue;
  }
  //  Logic to add tower +++++++++++++++++++++++
  canAddTower(cell) {
    // add conditions before allowing user to place turret
    // Some money required but also cannot place tower on a cell
    // of the grid that is occupied or is the root cell
    if(towerGame.placingTower) {
        if(!cell.occupied && !cell.hasTower && cell != towerGame.root)
            return true;
      }
    return(false);
  }

  createTower(mtd) { // menu turret div
    // create a new tower object and add to array list
    // the menu tower div contains the parameters for the tower
    var tower = new Tower( mtd.cost, mtd.cnvTurImg, mtd.cnvBulImg);
    if(tower)
      this.towers.push(tower); // add tower to the end of the array of towers
    else {
      println('failed to make tower');
    }
  }

  placeTower(cell) {
    //  place tower into play area at center of cell
    towerGame.towers[towerGame.towers.length-1].loc = cell.center.copy();
//    console.log(towerGame.towers[towerGame.towers.length-1].loc.toString());
    //  tower needs to know if it is placed
    towerGame.towers[towerGame.towers.length-1].placed = true;
    cell.hasTower = true;
    //  only one tower placed at a time
    towerGame.placingTower = false;
    // placing a tower makes the cell containing the tower
    // unavailable to enemies the same as if it were
    // occupied (blocked)
    towerGame.brushfire();   // all new distances and parents
  }

//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++ load callbacks
  loadDOMCallBacks(menuTiles) {
    //  load tile menu callbacks
    for (var i = 0; i < menuTiles.length; i++) {
        var mtd = menuTiles[i];
        mtd.addEventListener('mouseover',this.tileRollOver,false);
        mtd.addEventListener('mouseout', this.tileRollOut, false);
        mtd.addEventListener('mousedown', this.tilePressed, false);
        mtd.addEventListener('click', this.tileClicked, false);
    }

  }

  //+++++++++++++++++++++++++   tile menu callbacks
  tileRollOver() {
    this.style.backgroundColor = '#f7e22a';
  }

  tileRollOut() {
    this.style.backgroundColor = '#DDD';
  }

  tilePressed() {
    this.style.backgroundColor = '#900';
  }

  tileClicked() {
    //if user clicks tile and not placing tile change placing to true
    // can add Tower checks cost and other conditions
    if(towerGame.placingTower === true) return;
    if (towerGame.getBankValue() > 100) {
      towerGame.createTower(this);
      towerGame.placingTower = true;
    }

  }
//  ++++++++++++++++++++++++++++++++++++++++++++++++++    mouse handlers
  handleCNVMouseOver() {
    if(towerGame.towers.length < 1) return;
    towerGame.towers[towerGame.towers.length-1].visible = true;
  }

  handleCNVMouseMoved(event) {
    // add some properties to the canvas to track the mouse.
    this.mouseX = event.offsetX;
    this.mouseY = event.offsetY;
    if(towerGame.towers.length < 1) return;
    if(!towerGame.towers[towerGame.towers.length-1].placed &&
      towerGame.placingTower === true ){
        //follow mouse
        towerGame.towers[towerGame.towers.length-1].loc.x = this.mouseX;
        towerGame.towers[towerGame.towers.length-1].loc.y = this.mouseY;
//        console.log(this.mouseX + ", " + this.mouseY + ", " + towerGame.towers[towerGame.towers.length-1].loc.toString());
      }
  }

  handleCNVMouseClicked(event) {
    var row = Math.floor(event.offsetY/towerGame.w);
    var col = Math.floor(event.offsetX/towerGame.w);
    var cell = towerGame.grid[col][row];
    if(towerGame.placingTower && towerGame.canAddTower(cell)){
      towerGame.placeTower(cell);
    }
    else if(!towerGame.placingTower && !cell.hasTower) {
        // toggle the occupied property of the clicked cell
        cell.occupied = !cell.occupied;
        towerGame.brushfire();   // all new distances and parents
        }
  }
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++ Other
} // end Game class +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
