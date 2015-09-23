
var uiLayout = [
  '<div class="ot-bubbles"></div>',
  '<div class="ot-input">',
  '  <p class="ot-error-zone" hidden>Error sending the message!</p>',
  '  <div>',
  '    <textarea placeholder="Write here&hellip;" class="ot-composer"></textarea>',
  '    <div class="ot-bottom-line">',
  '      <p class="ot-character-counter"><span></span> characters left</p>',
  '      <button class="ot-send-button">Send ›</button>',
  '    </div>',
  '  </div>',
  '</div>'
].join('\n');

var bubbleLayout = [
  '<div>',
  '  <header class="ot-bubble-header">',
  '    <p class="ot-message-sender"></p>',
  '    <time class="ot-message-timestamp"></time>',
  '  </header>',
  '</div>'
].join('\n');

function ChatUI(options) {
  options = options || {};
  this.senderId = options.senderId || ('' + Math.random()).substr(2);
  this.senderAlias = options.senderAlias || 'me';
  this.maxTextLength = options.maxTextLength || 1000;
  this.groupDelay = options.groupDelay || (2 * 60 * 1000); // 2 min
  this.timeout = options.timeout || 5000;
  this._messages = [];
  this._setupTemplates();
  this._setupUI(options.container);
  this._updateCharCounter();
}

ChatUI.prototype = {
  constructor: ChatUI,

  _setupTemplates: function () {
    this._bubbleTemplate = document.createElement('section');
    this._bubbleTemplate.innerHTML = bubbleLayout;
    this._bubbleTemplate.classList.add('ot-bubble');
  },

  _setupUI: function (parent) {
    parent = document.querySelector(parent) || document.body;

    var chatView = document.createElement('section');
    chatView.innerHTML = uiLayout;
    chatView.classList.add('ot-textchat');

    var sendButton = chatView.querySelector('.ot-send-button');
    var composer = chatView.querySelector('.ot-composer');
    var charCounter = chatView.querySelector('.ot-character-counter > span');
    var errorZone = chatView.querySelector('.ot-error-zone');

    this._composer = composer;
    this._sendButton = sendButton;
    this._charCounter = charCounter;
    this._bubbles = chatView.firstElementChild;
    this._errorZone = errorZone;

    this._sendButton.onclick = this._sendMessage.bind(this);
    this._composer.onkeyup = this._updateCharCounter.bind(this);
    this._composer.onkeydown = this._controlComposerInput.bind(this);

    parent.appendChild(chatView);
  },

  _sendMessage: function () {
    var _this = this;
    var contents = this._composer.value;

    if (contents.length > _this.maxTextLength) {
      _this._showTooLongTextError();
    }
    else {
      _this._hideErrors();
      if (typeof _this.onMessageReadyToSend === 'function') {
        _this.disableSending();

        var timeout = setTimeout(function () {
          _this.showError();
          _this.enableSending();
        }, _this.timeout);

        var sent = _this.onMessageReadyToSend(contents, function (err) {
          clearTimeout(timeout);
          if (err) {
            _this._showError();
          }
          else {
            _this.addMessage(new ChatMessage(
              _this.senderId,
              _this.senderAlias,
              contents
            ));
            _this._composer.value = '';
            _this._updateCharCounter();
          }
          _this.enableSending();
        });

      }
    }
  },

  _showTooLongTextError: function () {
    this._charCounter.classList.add('error');
  },

  _showError: function () {
    this._errorZone.hidden = false;
  },

  _hideErrors: function () {
    this._errorZone.hidden = true;
    this._charCounter.classList.remove('error');
  },

  _showError: function () {
    this._errorZone.hidden = false;
  },

  _controlComposerInput: function (evt) {
    var isEnter = evt.which === 13 || evt.keyCode === 13;
    if (!evt.shiftKey && isEnter) {
      evt.preventDefault();
      this._sendMessage();
    }
  },

  _updateCharCounter: function () {
    var remaining = this.maxTextLength - this._composer.value.length;
    var isValid = remaining >= 0;
    this._charCounter.classList[!isValid ? 'add' : 'remove']('error');
    this._charCounter.textContent = remaining;
  },

  addMessage: function (message) {
    var shouldGroup = this._shouldGroup(message);
    this[ shouldGroup ? '_groupBubble' : '_addNewBubble' ](message);
    this._messages.push(message);
  },

  enableSending: function () {
    this._sendButton.removeAttribute('disabled');
    this._composer.removeAttribute('disabled');
    this._composer.focus();
  },

  disableSending: function () {
    this._sendButton.disabled = true;
    this._composer.disabled = true;
  },

  _shouldGroup: function (message) {
    if (this._lastMessage && this._lastMessage.senderId === message.senderId) {
      var reference = this._lastMessage.dateTime.getTime();
      var newDate = message.dateTime.getTime();
      return newDate - reference < this.groupDelay;
    }
    return false;
  },

  _groupBubble: function (message) {
    this._lastBubble.appendChild(this._getBubbleContent(message.text));
    this._lastTimestamp.textContent = this._humanize(message.dateTime);
  },

  _addNewBubble: function (message) {
    this._bubbles.appendChild(this._getBubble(message));
  },

  get _lastMessage() {
    return this._messages[this._messages.length - 1];
  },

  get _lastBubble() {
    return this._bubbles.lastElementChild.querySelector('div');
  },

  get _lastTimestamp() {
    return this._bubbles
      .lastElementChild.querySelector('.ot-message-timestamp');
  },

  _getBubbleContent: function (safeHtml) {
    var div = document.createElement('DIV');
    div.classList.add('ot-bubble-content');
    div.innerHTML = safeHtml;
    return div;
  },

  _getBubble: function (message) {
    var bubble = this._bubbleTemplate.cloneNode(true);
    var wrapper = bubble.querySelector('div');
    var sender = wrapper.querySelector('.ot-message-sender');
    var timestamp = wrapper.querySelector('.ot-message-timestamp');

    // Sender & alias
    bubble.dataset.senderId = message.senderId;
    if (message.senderId === this.senderId) {
      bubble.classList.add('mine');
    }
    sender.textContent = message.senderAlias;

    // Content
    wrapper.appendChild(this._getBubbleContent(message.text));

    // Timestamp
    timestamp.dateTime = message.dateTime.toISOString();
    timestamp.textContent = this._humanize(message.dateTime);

    return bubble;
  },

  _humanize: function (date) {
    return date.toUTCString();
  }
};

function ChatMessage(senderId, senderAlias, text) {
  Object.defineProperties(this, {
    senderId: { value: senderId },
    senderAlias: { value: senderAlias },
    text: { value: text },
    dateTime: { value: new Date() }
  });
}

export { ChatUI, ChatMessage };