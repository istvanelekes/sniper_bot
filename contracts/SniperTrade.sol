// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SniperTrade {
    address public owner;
    mapping(address => mapping(address => uint256)) private trades;

    constructor() {
        owner = msg.sender;
    }

    function buyToken(
        address router,
        address tokenIn,
        uint256 amount,
        address tokenOut,
        uint24 fee
    ) external {
        require(msg.sender == owner, 'Only the owner can buy');

        trades[tokenIn][tokenOut] = amount;

        // Swap the amount of token0 and expect to get X amount of token1
        _swapOnV3(
            router,
            tokenIn,
            amount,
            tokenOut,
            0,
            fee
        );
    }

    function sellToken(
        address router,
        address tokenIn,
        address tokenOut,
        uint24 fee
    ) external {
        require(msg.sender == owner);

        uint256 amountIn = IERC20(tokenIn).balanceOf(address(this));
        uint256 amountOut = trades[tokenOut][tokenIn];

        // Swap the amount of token0 and expect to get X amount of token1
        _swapOnV3(
            router,
            tokenIn,
            amountIn,
            tokenOut,
            amountOut,
            fee
        );

        // Transfer any excess tokens [i.e. profits] to owner
        uint256 tokenBalance = IERC20(tokenOut).balanceOf(address(this));
        if (tokenBalance > amountOut) {
            IERC20(tokenOut).transfer(owner, tokenBalance - amountOut);
        }
    }

    // -- INTERNAL FUNCTIONS -- //

    function _swapOnV3(
        address _router,
        address _tokenIn,
        uint256 _amountIn,
        address _tokenOut,
        uint256 _amountOut,
        uint24 _fee
    ) internal {
        // Approve token to swap
        IERC20(_tokenIn).approve(_router, _amountIn);

        // Setup swap parameters
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: _tokenIn,
                tokenOut: _tokenOut,
                fee: _fee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: _amountIn,
                amountOutMinimum: _amountOut,
                sqrtPriceLimitX96: 0
            });

        // Perform swap
        ISwapRouter(_router).exactInputSingle(params);
    }
}
