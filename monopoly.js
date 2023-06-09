const api = require('./api.js');

function roll(game) {
  const dice1 = Math.floor(Math.random() * 6) + 1;
  const dice2 = Math.floor(Math.random() * 6) + 1;
  game.dice = [dice1, dice2];
  const player = game.players[game.actualPlayer];
  if (!player.jail && player.doublesCount == 2 && dice1 == dice2) {
    console.log('JAIL 3 DOUBLES');
    sendToJail(player);
    setTimeout(() => {
      skip(game);
    }, 6000);
    game.actions = [];
    const index = require('./index');
    index.updateGame(game);
  } else {
    calcMovePlayer(game);
  }
}

function pay(game) {
  const player = game.players[game.actualPlayer];
  const square = game.actualSquare;
  if (player.jail) {
    if (player.money >= 50) {
      player.money -= 50;
      player.jail = false;
      player.jailTime = 0;
      console.log('Player paid to get out of jail');
      calcMovePlayer(game);
    } else {
      console.log('Player has no money');
    }
  } else if (square.type == 'property' || square.type == 'station' || square.type == 'supply') {
    const owner = game.players.find(p => p.id == square.owner);
    let rent = square.rents.find(r => r.upgrades == square.upgrades).rent;
    if (square.type == 'supply') {
      dices = game.dice[0] + game.dice[1];
      rent = rent * dices;
    }
    if (player.money >= rent) {
      player.money -= rent;
      owner.money += rent;
      console.log('Rent: ' + rent);
      setTimeout(() => {
        skip(game);
      }, 6000);
      game.actions = [];
    } else {
      console.log('Player has no money');
      console.log('Player money: ' + player.money);
      console.log('Rent: ' + rent);
      forfeit(game, player);
    }
  } else if (square.type == 'tax') {
    if (player.money >= square.amount) {
      player.money -= square.amount;
      game.taxes += square.amount;
      console.log('Tax: ' + square.amount);
      setTimeout(() => {
        skip(game);
      }, 6000);
      game.actions = [];
    } else {
      console.log('Player has no money');
      console.log('Player money: ' + player.money);
      console.log('Tax: ' + square.amount);
      forfeit(game, player);
    }
  } else if (game.actualCard) {
    if (game.actualCard.action == 'PAY') {
      if (player.money >= game.actualCard.amount) {
        player.money -= game.actualCard.amount;
        console.log('Card: ' + game.actualCard.amount);
        setTimeout(() => {
          skip(game);
        }, 6000);
        game.actions = [];
      } else {
        console.log('Player has no money');
        console.log('Player money: ' + player.money);
        console.log('Card: ' + game.actualCard.amount);
        forfeit(game, player);
      }
    } else if (game.actualCard.action == 'PAY_CONDITIONAL') {
      const ownedProperties = player.properties.filter(p => p.type == 'property');
      let amount = 0;
      ownedProperties.forEach(p => {
        if (p.upgrades > 0 && p.upgrades < 5) {
          amount += p.amountHouse * p.upgrades;
        } else if (p.upgrades == 5) {
          amount += p.amountHotel;
        }
      });
      if (player.money >= amount) {
        player.money -= amount;
        console.log('Card: ' + amount);
        setTimeout(() => {
          skip(game);
        }, 6000);
        game.actions = [];
      } else {
        console.log('Player has no money');
        console.log('Player money: ' + player.money);
        console.log('Card: ' + amount);
        forfeit(game, player);
      }
    }
  }
}

function buy(game, player) {
  const square = game.squares.find(s => s.id == player.position);
  if (square.type == 'property' || square.type == 'station' || square.type == 'supply') {
    if (square.owner == null && player.money >= square.price) {
      player.money -= square.price;
      player.properties.push(square);
      player.properties.sort(function (a, b) {
        if (a.type != b.type) {
          if (a.type == 'property') {
            return -1;
          } else if (b.type == 'property') {
            return 1;
          } else if (b.type == 'station') {
            return 1;
          } else if (b.type == 'supply') {
            return -1;
          }
        } else {
          if (a.id < b.id) {
            return -1;
          } else {
            return 1;
          }
        }
      });
      square.owner = player.id;
      calcUpgrades(game, player);
      calcActions(game);
    } else {
      console.log(player)
      if (square.owner == player.name) {
        console.log('Already bought');
      } else {
        console.log('Not enough money');
      }
    }
  } else {
    console.log('Cannot buy this square');
  }
}

function upgrade(game, player) {
  const square = game.squares.find(s => s.id == player.position);
  console.log(square);
  if (square.type == 'property' && square.owner == player.id) {
    if (square.upgrades < 5) {
      if (player.money >= square.housePrice) {
        player.money -= square.housePrice;
        square.upgrades++;
        calcActions(game);
      } else {
        console.log('Not enough money');
      }
    } else {
      console.log('Max level reached');
    }
  } else {
    console.log('Cannot upgrade this square');
  }
}

function downgrade(game, player) {
  const square = game.squares.find(s => s.id == player.position);
  if (square.type == 'property' && square.owner == player.id) {
    if (square.upgrades > 0) {
      player.money += square.housePrice / 2;
      square.upgrades--;
      calcActions(game);
    } else {
      console.log('Min level reached');
    }
  } else {
    console.log('Cannot downgrade this square');
  }
}

function mortgage(game, player) {
  const square = game.squares.find(s => s.id == player.position);
  if (player.properties.includes(square)) {
    player.money += square.price / 2;
    game.actualSquare.state = 'mortgaged';
    calcActions(game);
  } else {
    console.log('Cannot mortgage this square');
  }
}

function unmortgage(game, player) {
  const square = game.squares.find(s => s.id == player.position);
  if (player.money >= square.price / 2) {
    player.money -= square.price / 2;
    game.actualSquare.state = 'normal';
    calcActions(game);
  } else {
    console.log('Not enough money');
  }
}

function jailCard(game) {
  const player = game.players[game.actualPlayer];
  player.cards = player.cards.slice(1);
  player.jail = false;
  player.jailTime = 0;
  calcMovePlayer(game);
}

function skip(game) {
  const player = game.players[game.actualPlayer];

  if (player.jail) {
    console.log('IN JAIL');
    player.jailTime++;
  } else if (game.actualSquare.type == 'go_to_jail') {
    console.log('GO TO JAIL');
    sendToJail(player);
    player.jailTime++;
  } else if (game.dice[0] == game.dice[1]) {
    console.log('DOUBLE DICE');
    game.actualPlayer--;
    player.doublesCount++;
  } else {
    player.doublesCount = 0;
  }

  game.actualSquare = null;
  game.actualCard = null;
  game.actualPlayer++;
  if (game.actualPlayer == game.players.length) {
    game.actualPlayer = 0;
  }

  game.actions = ['roll', 'forfeit'];
  console.log('Next player: ' + game.players[game.actualPlayer].name);
  const index = require('./index');
  index.updateGame(game);
}

function forfeit(game, player) {
  player.money = -1;
  player.properties.forEach(p => {
    p.owner = null;
    p.upgrades = 0;
    p.state = 'normal';
  });
  player.properties = [];
  player.cards = [];
  game.players = game.players.filter(p => p.id != player.id);
  if (game.actualPlayer > game.players.length - 1) {
    game.actualPlayer = 0;
  }
  console.log('Player forfeit: ' + player.name);
  const index = require('./index');
  index.updateGame(game);
}

// PRIVATE FUNCTIONS
async function calcMovePlayer(game) {
  const player = game.players[game.actualPlayer];
  if (player.jail) {
    console.log('Dice: ' + game.dice[0] + ' ' + game.dice[1]);
    if (game.dice[0] == game.dice[1]) {
      player.jail = false;
      player.jailTime = 0;
      movePlayer(game, game.dice[0] + game.dice[1]);
    } else {
      if (player.jailTime > 2) {
        if (player.money >= 50) {
          player.money -= 50;
          player.jailTime = 0;
          player.jail = false;
          movePlayer(game, game.dice[0] + game.dice[1]);
        } else {
          forfeit(game, player);
        }
      } else {
        if (player.cards.length > 0) {
          game.actions = ['jailcard', 'pay', 'skip', 'forfeit'];
        } else {
          game.actions = ['skip', 'pay', 'forfeit'];
        }
        const index = require('./index');
        index.updateGame(game);
      }
    }
  } else {
    const amount = game.dice[0] + game.dice[1];
    console.log('Dice: ' + game.dice[0] + ' ' + game.dice[1]);
    movePlayer(game, amount);
  }
}

async function movePlayer(game, amount) {
  const player = game.players[game.actualPlayer];
  player.position += amount;
  if (player.position > 40) {
    player.position -= 40;
    player.money += 200;
  }

  game.actualSquare = game.squares.find(s => s.id == player.position);
  if ((game.actualSquare.type == 'property'
    || game.actualSquare.type == 'station'
    || game.actualSquare.type == 'supply')
    && game.actualSquare.rents.length == 0) {
    console.log('Getting rents');
    api.getRents(game);
  }

  console.log('Player position: ' + player.position);
  calcActions(game);
}

async function movePlayerTo(game, position) {
  const player = game.players[game.actualPlayer];
  if (position < 1) {
    player.position = -position;
  } else {
    if (position < player.position) {
      player.money += 200;
    }
    player.position = position;
  }
  game.actualSquare = game.squares.find(s => s.id == player.position);
  if ((game.actualSquare.type == 'property'
    || game.actualSquare.type == 'station'
    || game.actualSquare.type == 'supply')
    && game.actualSquare.rents.length == 0) {
    console.log('Getting rents');
    game.actualSquare.rents = await api.getRents(game);
  }
  console.log('Player position: ' + player.position);
  console.log(game.actualSquare);
  calcActions(game);
}


async function calcActions(game) {
  const player = game.players[game.actualPlayer];
  const square = game.actualSquare;
  if (square.type == 'property' || square.type == 'station' || square.type == 'supply') {
    if (square.owner == null) {
      game.actions = ['buy', 'skip', 'forfeit'];
    } else if (square.owner == player.id) {
      if (square.state == 'mortgaged') {
        console.log('Square is mortgaged');
        game.actions = ['unmortgage', 'skip', 'forfeit'];
      } else {
        console.log('Player owns this square');
        console.log('Square is not mortgaged');
        const colorSquares = game.squares.filter(s => s.color == square.color);
        if (square.type == 'property'
          && colorSquares.every(s => s.owner == player.id)
          && player.money >= square.housePrice) {
          if (square.upgrades == 0) {
            game.actions = ['upgrade', 'mortgage', 'skip', 'forfeit'];
          } else if (square.upgrades == 5) {
            game.actions = ['downgrade', 'mortgage', 'skip', 'forfeit'];
          } else {
            game.actions = ['upgrade', 'downgrade', 'mortgage', 'skip', 'forfeit'];
          }
        } else {
          game.actions = ['skip', 'mortgage', 'forfeit'];
        }
      }
    } else {
      console.log('Player does not own this square');
      if (square.state == 'mortgaged') {
        console.log('Square is mortgaged');
        setTimeout(() => {
          skip(game);
        }, 6000);
        game.actions = [];
      } else {
        console.log('Square is not mortgaged');
        pay(game);
      }
    }

  } else if (square.type == 'tax') {
    game.actions = [];
    pay(game);
  } else if (square.type == 'free_parking') {
    game.players[game.actualPlayer].money += game.taxes;
    game.taxes = 0;
    game.actions = [];
    setTimeout(() => {
      skip(game);
    }, 6000);
    game.actions = [];
  } else if (square.type == 'chance' || square.type == 'community_chest') {
    api.getCard(game, square.type.toUpperCase());
  } else {
    setTimeout(() => {
      skip(game);
    }, 6000);
    game.actions = [];
  }
  const index = require('./index');
  index.updateGame(game);
}

function calcCardActions(game) {
  console.log(game.actualCard);
  switch (game.actualCard.action) {
    case 'PAY':
      if (game.actualCard.amount > 0) {
        game.actions = [];
        pay(game);
      } else {
        if (game.actualCard.target == 'PLAYER') {
          game.players.forEach(p => {
            if (p.id != game.players[game.actualPlayer].id) {
              if (p.money >= -game.actualCard.amount) {
                p.money += game.actualCard.amount;
              } else {
                console.log('Player: ' + p.name + ' has no money');
                console.log('Player money: ' + p.money);
                console.log('Card: ' + game.actualCard.amount);
                forfeit(game, p);
              }
            } else {
              p.money -= game.actualCard.amount * (game.players.length - 1);
            }
          });
        } else {
          game.players[game.actualPlayer].money -= game.actualCard.amount;
        }
        setTimeout(() => {
          skip(game);
        }, 6000);
        game.actions = [];
      }
      break;
    case 'PAY_CONDITIONAL':
      pay(game);
      break;
    case 'ADVANCE':
      setTimeout(() => {
        movePlayerTo(game, game.actualCard.square);
      }, 8000);
      game.actions = [];
      break;
    case 'ADVANCE_CONDITIONAL':
      setTimeout(() => {
        movePlayer(game, game.actualCard.amount);
      }, 8000);
      game.actions = [];
      break;
    case 'FREE_JAIL':
      const player = game.players[game.actualPlayer];
      player.cards.push(game.actualCard);
      setTimeout(() => {
        skip(game);
      }, 6000);
      game.actions = [];
      break;
    case 'JAIL':
      sendToJail(game.players[game.actualPlayer]);
      setTimeout(() => {
        skip(game);
      }, 6000);
      game.actions = [];
      break;
    default:
      console.log('Action not found');
      break;
  }
  const index = require('./index');
  index.updateGame(game);
}

function calcUpgrades(game, player) {
  const square = game.squares.find(s => s.id == player.position);
  if (square.type == 'property') {
    square.upgrades = 0;
  } else if (square.type == 'station' || square.type == 'supply') {
    const ownedStations = player.properties.filter(p => p.type == square.type);
    ownedStations.forEach(s => {
      s.upgrades = ownedStations.length;
    });
  }
}

function sendToJail(player) {
  player.jail = true;
  player.jailTime = 0;
  player.position = 11;
  player.doublesCount = 0;
}

module.exports = {
  roll,
  pay,
  buy,
  upgrade,
  downgrade,
  mortgage,
  unmortgage,
  jailCard,
  skip,
  forfeit,
  calcCardActions,
};