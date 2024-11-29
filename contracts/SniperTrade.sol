// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

import {IV3SwapRouter} from '@uniswap/swap-router-contracts/contracts/interfaces/IV3SwapRouter.sol';
import {ISwapRouter02} from '@uniswap/swap-router-contracts/contracts/interfaces/ISwapRouter02.sol';

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SniperTrade {
    address public owner;

    modifier onlyOwner() {
        require(
            msg.sender == owner,
            "SniperTrade: caller is not the owner!"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Don't allow contract to receive Ether by mistake
    fallback() external {
        revert();
    }

    /**
     * Buy a token on Uniswap or compatible Dex's
     * @param _router Router address to Uniswap compatible Dex's
     * @param _tokenIn Token address to sell
     * @param _amount Token amount to sell
     * @param _tokenOut Token address to buy
     * @param _fee swap fee
     */
    function buyToken(
        address _router,
        address _tokenIn,
        uint256 _amount,
        address _tokenOut,
        uint24 _fee
    ) external onlyOwner {
        uint256 tokenInBalance = IERC20(_tokenIn).balanceOf(address(this));
        require(tokenInBalance > _amount, "SniperTrade: token balance must be greater than amount");

        // Swap the amount of token0 and expect to get X amount of token1
        _swapOnV3(
            _router,
            _tokenIn,
            _amount,
            _tokenOut,
            0,
            _fee
        );
    }

    /**
     * Sell a token on Uniswap or compatible Dex's
     * @param _router Router address to Uniswap compatible Dex's
     * @param _tokenIn Token address to sell
     * @param _tokenOut Token address to buy
     * @param _fee swap fee
     */
    function sellToken(
        address _router,
        address _tokenIn,
        address _tokenOut,
        uint24 _fee
    ) external onlyOwner {
        uint256 amountIn = IERC20(_tokenIn).balanceOf(address(this));
        require(amountIn > 0, "SniperTrade: sell amount must be greater than 0");

        // Swap the amount of token0 and expect to get X amount of token1
        _swapOnV3(
            _router,
            _tokenIn,
            amountIn,
            _tokenOut,
            0,
            _fee
        );
    }

    /**
     * Withdraw any tokens accidentally sent or extra balance remaining.
     * @param _tokenAddress Token address to withdraw.
     */
    function withdrawToken(address _tokenAddress) public onlyOwner {
        uint256 balance = IERC20(_tokenAddress).balanceOf(address(this));
        IERC20(_tokenAddress).transfer(owner, balance);
    }

    /**
     * Withdraw x percent of tokens extra balance remaining.
     * @param _tokenAddress Token address to withdraw.
     * @param _percent Token amount percentage
     */
    function withdrawTokenAtPercent(address _tokenAddress, uint256 _percent) public onlyOwner {
        uint256 balance = IERC20(_tokenAddress).balanceOf(address(this));
        uint256 amount = balance * _percent / 100;
        IERC20(_tokenAddress).transfer(owner, amount);
    }

    /// Withdraw Ether from the contract
    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;

        (bool succes, ) = payable(msg.sender).call{ value: balance }("");
        require(succes, "Failed to send Ether");
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
        ISwapRouter02.ExactInputSingleParams memory params = IV3SwapRouter
            .ExactInputSingleParams({
                tokenIn: _tokenIn,
                tokenOut: _tokenOut,
                fee: _fee,
                recipient: address(this),
                amountIn: _amountIn,
                amountOutMinimum: _amountOut,
                sqrtPriceLimitX96: 0
            });

        // Perform swap
        ISwapRouter02(_router).exactInputSingle(params);
    }
}
