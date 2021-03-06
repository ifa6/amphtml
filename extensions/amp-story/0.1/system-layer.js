/**
 * Copyright 2017 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {EventType, dispatch} from './events';
import {renderAsElement} from './simple-template';
import {dict} from '../../../src/utils/object';
import {dev} from '../../../src/log';
import {Services} from '../../../src/services';
import {ProgressBar} from './progress-bar';
import {getMode} from '../../../src/mode';
import {DevelopmentModeLog, DevelopmentModeLogButtonSet} from './development-ui'; // eslint-disable-line max-len


const MUTE_CLASS = 'i-amphtml-story-mute-audio-control';

const UNMUTE_CLASS = 'i-amphtml-story-unmute-audio-control';

const FULLSCREEN_CLASS = 'i-amphtml-story-exit-fullscreen';

const CLOSE_CLASS = 'i-amphtml-story-bookend-close';

/** @private @const {!./simple-template.ElementDef} */
const TEMPLATE = {
  tag: 'aside',
  attrs: dict({'class': 'i-amphtml-story-system-layer'}),
  children: [
    {
      tag: 'div',
      attrs: dict({'class': 'i-amphtml-story-ui-left'}),
      children: [
        {
          tag: 'div',
          attrs: dict({
            'role': 'button',
            'class': UNMUTE_CLASS + ' i-amphtml-story-button',
          }),
        },
        {
          tag: 'div',
          attrs: dict({
            'role': 'button',
            'class': MUTE_CLASS + ' i-amphtml-story-button',
          }),
        },
      ],
    },
    {
      tag: 'div',
      attrs: dict({'class': 'i-amphtml-story-ui-right'}),
      children: [
        {
          tag: 'div',
          attrs: dict({
            'role': 'button',
            'class': UNMUTE_CLASS + ' i-amphtml-story-button',
          }),
        },
        {
          tag: 'div',
          attrs: dict({
            'role': 'button',
            'class': MUTE_CLASS + ' i-amphtml-story-button',
          }),
        },
        {
          tag: 'div',
          attrs: dict({
            'role': 'button',
            'class': FULLSCREEN_CLASS + ' i-amphtml-story-button',
            'hidden': true,
          }),
        },
        {
          tag: 'div',
          attrs: dict({
            'role': 'button',
            'class': CLOSE_CLASS + ' i-amphtml-story-button',
            'hidden': true,
          }),
        },
      ],
    },
  ],
};


/**
 * @param {!../../../src/service/vsync-impl.Vsync} vsync
 * @param {!Element} el
 * @param {boolean} isHidden
 */
function toggleHiddenAttribute(vsync, el, isHidden) {
  vsync.mutate(() => {
    if (isHidden) {
      el.setAttribute('hidden', 'hidden');
    } else {
      el.removeAttribute('hidden');
    }
  });
}


/**
 * System Layer (i.e. UI Chrome) for <amp-story>.
 * Chrome contains:
 *   - mute/unmute button
 *   - fullscreen button
 *   - story progress bar
 *   - bookend close butotn
 */
export class SystemLayer {
  /**
   * @param {!Window} win
   */
  constructor(win) {
    /** @private {!Window} */
    this.win_ = win;

    /** @private {boolean} */
    this.isBuilt_ = false;

    /** @private {?Element} */
    this.root_ = null;

    /** @private {?Element} */
    this.exitFullScreenBtn_ = null;

    /** @private {?Element} */
    this.closeBookendBtn_ = null;

    /** @private {?Element} */
    this.muteAudioBtn_ = null;

    /** @private {?Element} */
    this.unmuteAudioBtn_ = null;

    /** @private {?Element} */
    this.leftButtonTray_ = null;

    /** @private @const {!ProgressBar} */
    this.progressBar_ = ProgressBar.create(win);

    /** @private {!DevelopmentModeLog} */
    this.developerLog_ = DevelopmentModeLog.create(win);

    /** @private {!DevelopmentModeLogButtonSet} */
    this.developerButtons_ = DevelopmentModeLogButtonSet.create(win);
  }

  /**
   * @param {number} pageCount The number of pages in the story.
   * @return {!Element}
   */
  build(pageCount) {
    if (this.isBuilt_) {
      return this.getRoot();
    }

    this.isBuilt_ = true;

    this.root_ = renderAsElement(this.win_.document, TEMPLATE);

    this.root_.insertBefore(
        this.progressBar_.build(pageCount), this.root_.firstChild);

    this.leftButtonTray_ =
        this.root_.querySelector('.i-amphtml-story-ui-left');

    this.buildForDevelopmentMode_();

    this.exitFullScreenBtn_ =
        this.root_.querySelector('.i-amphtml-story-exit-fullscreen');

    this.closeBookendBtn_ =
        this.root_.querySelector('.i-amphtml-story-bookend-close');

    this.addEventHandlers_();

    return this.getRoot();
  }

  /**
   * @private
   */
  buildForDevelopmentMode_() {
    if (!getMode().development) {
      return;
    }

    this.leftButtonTray_.appendChild(this.developerButtons_.build(
        this.developerLog_.toggle.bind(this.developerLog_)));
    this.root_.appendChild(this.developerLog_.build());
  }

  /**
   * @private
   */
  addEventHandlers_() {
    // TODO(alanorozco): Listen to tap event properly (i.e. fastclick)
    this.root_.addEventListener('click', e => {
      const target = dev().assertElement(e.target);

      if (target.matches(`.${FULLSCREEN_CLASS}, .${FULLSCREEN_CLASS} *`)) {
        this.onExitFullScreenClick_(e);
      } else if (target.matches(`.${CLOSE_CLASS}, .${CLOSE_CLASS} *`)) {
        this.onCloseBookendClick_(e);
      } else if (target.matches(`.${MUTE_CLASS}, .${MUTE_CLASS} *`)) {
        this.onMuteAudioClick_(e);
      } else if (target.matches(`.${UNMUTE_CLASS}, .${UNMUTE_CLASS} *`)) {
        this.onUnmuteAudioClick_(e);
      }
    });
  }


  /**
   * @return {!Element}
   */
  getRoot() {
    return dev().assertElement(this.root_);
  }

  /**
   * @param {boolean} inFullScreen
   */
  setInFullScreen(inFullScreen) {
    this.toggleExitFullScreenBtn_(inFullScreen);
  }

  /**
   * @param {boolean} isEnabled
   * @private
   */
  toggleExitFullScreenBtn_(isEnabled) {
    toggleHiddenAttribute(
        Services.vsyncFor(this.win_),
        dev().assertElement(this.exitFullScreenBtn_),
        /* opt_isHidden */ !isEnabled);
  }

  /**
   * @param {boolean} isEnabled
   */
  toggleCloseBookendButton(isEnabled) {
    toggleHiddenAttribute(
        Services.vsyncFor(this.win_),
        dev().assertElement(this.closeBookendBtn_),
        /* opt_isHidden */ !isEnabled);
  }

  /**
   * @param {!Event} e
   * @private
   */
  onExitFullScreenClick_(e) {
    this.dispatch_(EventType.EXIT_FULLSCREEN, e);
  }

  /**
   * @param {!Event} e
   * @private
   */
  onCloseBookendClick_(e) {
    this.dispatch_(EventType.CLOSE_BOOKEND, e);
  }

  /**
   * @param {!Event} e
   * @private
   */
  onMuteAudioClick_(e) {
    this.dispatch_(EventType.MUTE, e);
  }

  /**
   * @param {!Event} e
   * @private
   */
  onUnmuteAudioClick_(e) {
    this.dispatch_(EventType.UNMUTE, e);
  }

  /**
   * @param {string} eventType
   * @param {!Event=} opt_event
   * @private
   */
  dispatch_(eventType, opt_event) {
    if (opt_event) {
      dev().assert(opt_event).stopPropagation();
    }

    dispatch(this.getRoot(), eventType, /* opt_bubbles */ true);
  }

  /**
   * @param {number} pageIndex The index of the new active page.
   * @public
   */
  setActivePageIndex(pageIndex) {
    this.progressBar_.setActivePageIndex(pageIndex);
  }


  /**
   * @param {!./logging.AmpStoryLogEntryDef} logEntry
   * @private
   */
  logInternal_(logEntry) {
    this.developerButtons_.log(logEntry);
    this.developerLog_.log(logEntry);
  }

  /**
   * Logs an array of entries to the developer logs.
   * @param {!Array<!./logging.AmpStoryLogEntryDef>} logEntries
   */
  logAll(logEntries) {
    if (!getMode().development) {
      return;
    }

    Services.vsyncFor(this.win_).mutate(() => {
      logEntries.forEach(logEntry => this.logInternal_(logEntry));
    });
  }

  /**
   * Logs a single entry to the developer logs.
   * @param {!./logging.AmpStoryLogEntryDef} logEntry
   */
  log(logEntry) {
    if (!getMode().development) {
      return;
    }

    this.logInternal_(logEntry);
  }

  /**
   * Clears any state held by the developer log or buttons.
   */
  resetDeveloperLogs() {
    if (!getMode().development) {
      return;
    }

    this.developerButtons_.clear();
    this.developerLog_.clear();
  }

  /**
   * Sets the string providing context for the developer logs window.  This is
   * often the name or ID of the element that all logs are for (e.g. the page).
   * @param {string} contextString
   */
  setDeveloperLogContextString(contextString) {
    if (!getMode().development) {
      return;
    }

    this.developerLog_.setContextString(contextString);
  }

  /**
   * Toggles the visibility of the developer log.
   * @private
   */
  toggleDeveloperLog_() {
    if (!getMode().development) {
      return;
    }

    this.developerLog_.toggle();
  }

  /**
   * Hides the developer log in the UI.
   */
  hideDeveloperLog() {
    if (!getMode().development) {
      return;
    }

    this.developerLog_.hide();
  }
}
